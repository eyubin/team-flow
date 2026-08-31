# Staging infrastructure (AWS ECS Fargate)

Terraform for the staging environment: one ECS Fargate cluster running the
backend and frontend as separate services (linked via ECS Service Connect,
so `nginx.conf`'s `http://backend:8080` resolves exactly like it does under
Docker Compose), an Application Load Balancer in front of the frontend only,
and a single-AZ RDS Postgres instance with no public IP. No NAT gateway --
Fargate tasks get public IPs directly and are gated by security groups, which
is the right cost/isolation trade-off for a staging box, not for a real
production tier.

Nothing here runs by itself. It needs to be applied once by hand, after
which `release.yml` deploys new images to it on every push to `main`.

## One-time setup

1. **Make the GHCR packages public** (Settings → Packages, for both
   `teamflow-backend` and `teamflow-frontend`, after the first `release.yml`
   run has created them) -- or set `ghcr_pat` in `terraform.tfvars` if you'd
   rather keep them private.

2. **Configure and apply Terraform:**

   ```bash
   cd infra/terraform
   cp terraform.tfvars.example terraform.tfvars
   # edit terraform.tfvars: github_repo, ghcr_owner
   terraform init
   terraform apply
   ```

   This provisions the VPC, ALB, ECS cluster/services, RDS instance, and the
   IAM role `release.yml` assumes via GitHub's OIDC provider -- no AWS access
   keys are stored in GitHub. The very first apply deploys whatever
   `backend_image_tag`/`frontend_image_tag` default to (`latest`), so run the
   `release` workflow once by hand afterwards to get a real build in place.

3. **Add to the repository's `staging` GitHub Environment** (Settings →
   Environments → New environment → `staging` -- must be named exactly
   `staging` to match `github_environment` and the IAM trust condition):

   - Secret `AWS_DEPLOY_ROLE_ARN` = `terraform output -raw github_actions_deploy_role_arn`
   - Variable `AWS_REGION` = the region you deployed to (e.g. `us-east-1`)
   - Variable `ECS_SUBNETS` = `terraform output -raw subnet_ids`
   - Variable `ECS_BACKEND_SG` = `terraform output -raw backend_security_group_id`

4. **Run the `release` workflow** (Actions → release → Run workflow, or just
   push to `main`). It builds and pushes both images to GHCR, runs Flyway as
   a one-off ECS task against the new image *before* touching the running
   service, then rolls out the backend and frontend services and smoke-tests
   the result. `terraform output staging_url` gives you the same URL.

## Why migrations are a separate step

Spring Boot runs Flyway automatically on startup, which is normally enough --
but the plan for this project calls for migrations as an explicit, checkable
CD step rather than something that happens implicitly inside a rolling
deploy. `release.yml` runs the new backend image once with
`--spring.main.web-application-type=none` (no HTTP server, so it starts,
migrates, and exits) as a standalone `ecs run-task`, and only updates the
real service if that task exits `0`. A bad migration fails the workflow with
the service still on the last known-good revision, instead of surfacing as a
half-migrated app cycling behind the deployment circuit breaker.

## Deliberately not here

- **HTTPS / a custom domain** -- no domain has been chosen yet. Point one at
  `aws_lb.main.dns_name`, add an ACM certificate and a 443 listener in
  `alb.tf`, and nothing else needs to change.
- **A production environment** -- this is staging only. The plan requires a
  protected environment and manual approval before a production tier exists;
  don't skip that gate by pointing this same config at prod.
- **Remote Terraform state** -- state is local to whoever runs `apply`. Fine
  solo; migrate to an S3 backend (see the comment in `versions.tf`) before
  more than one person touches this.

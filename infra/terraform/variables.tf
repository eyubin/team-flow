variable "aws_region" {
  description = "AWS region for the staging environment."
  type        = string
  default     = "us-east-1"
}

variable "project_name" {
  description = "Short name used as a prefix for all resource names."
  type        = string
  default     = "teamflow"
}

variable "environment" {
  description = "Deployment environment name (used in resource names and tags)."
  type        = string
  default     = "staging"
}

variable "github_repo" {
  description = "GitHub \"owner/repo\" allowed to assume the deploy role via OIDC. Required."
  type        = string

  validation {
    condition     = can(regex("^[^/]+/[^/]+$", var.github_repo))
    error_message = "github_repo must be in the form \"owner/repo\"."
  }
}

variable "github_environment" {
  description = "GitHub Actions environment name the deploy job runs under. Must match the `environment:` key in release.yml."
  type        = string
  default     = "staging"
}

variable "ghcr_owner" {
  description = "GHCR namespace (usually your GitHub username or org) that images are published under, e.g. ghcr.io/<ghcr_owner>/teamflow-backend."
  type        = string
}

variable "ghcr_pat" {
  description = <<-EOT
    Optional GitHub PAT (read:packages scope) used to pull images if the GHCR
    packages are private. Leave empty if the packages are public (recommended
    default for this project) -- no credentials are then created or needed.
  EOT
  type        = string
  default     = ""
  sensitive   = true
}

variable "backend_image_tag" {
  description = "Tag of the backend image to deploy, e.g. a commit SHA. Overridden per-deploy by the release workflow."
  type        = string
  default     = "latest"
}

variable "frontend_image_tag" {
  description = "Tag of the frontend image to deploy, e.g. a commit SHA. Overridden per-deploy by the release workflow."
  type        = string
  default     = "latest"
}

variable "vpc_cidr" {
  description = "CIDR block for the staging VPC."
  type        = string
  default     = "10.42.0.0/16"
}

variable "az_count" {
  description = "Number of availability zones to spread public subnets across."
  type        = number
  default     = 2
}

variable "db_instance_class" {
  description = "RDS instance class. db.t4g.micro is the smallest Postgres-compatible Graviton class and is Free Tier eligible in most accounts."
  type        = string
  default     = "db.t4g.micro"
}

variable "db_allocated_storage_gb" {
  description = "RDS allocated storage in GiB."
  type        = number
  default     = 20
}

variable "db_name" {
  description = "Postgres database name."
  type        = string
  default     = "teamflow"
}

variable "db_username" {
  description = "Postgres master username."
  type        = string
  default     = "teamflow"
}

variable "backend_cpu" {
  description = "Fargate task CPU units for the backend (256 = 0.25 vCPU)."
  type        = number
  default     = 512
}

variable "backend_memory" {
  description = "Fargate task memory (MiB) for the backend."
  type        = number
  default     = 1024
}

variable "frontend_cpu" {
  description = "Fargate task CPU units for the frontend."
  type        = number
  default     = 256
}

variable "frontend_memory" {
  description = "Fargate task memory (MiB) for the frontend."
  type        = number
  default     = 512
}

variable "log_retention_days" {
  description = "CloudWatch Logs retention for ECS task logs."
  type        = number
  default     = 14
}

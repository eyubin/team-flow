output "staging_url" {
  description = "URL of the staging environment."
  value       = "http://${aws_lb.main.dns_name}"
}

output "alb_dns_name" {
  value = aws_lb.main.dns_name
}

output "ecs_cluster_name" {
  value = aws_ecs_cluster.main.name
}

output "ecs_backend_service" {
  value = aws_ecs_service.backend.name
}

output "ecs_frontend_service" {
  value = aws_ecs_service.frontend.name
}

output "backend_task_family" {
  value = aws_ecs_task_definition.backend.family
}

output "frontend_task_family" {
  value = aws_ecs_task_definition.frontend.family
}

output "rds_endpoint" {
  value     = aws_db_instance.main.endpoint
  sensitive = true
}

output "github_actions_deploy_role_arn" {
  description = "Set this as the AWS_DEPLOY_ROLE_ARN GitHub Actions secret."
  value       = aws_iam_role.github_actions_deploy.arn
}

output "subnet_ids" {
  description = "Set this (comma-separated) as the ECS_SUBNETS GitHub Actions variable."
  value       = join(",", aws_subnet.public[*].id)
}

output "backend_security_group_id" {
  description = "Set this as the ECS_BACKEND_SG GitHub Actions variable."
  value       = aws_security_group.backend.id
}


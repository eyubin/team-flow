resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "disabled"
  }

  service_connect_defaults {
    namespace = aws_service_discovery_private_dns_namespace.internal.arn
  }
}

# Gives backend and frontend tasks Docker-Compose-style DNS resolution of
# each other ("backend:8080") without a second internal load balancer.
# frontend/nginx.conf already proxies to "http://backend:8080" for local
# Compose -- Service Connect makes that same hostname resolve inside ECS too,
# so nginx.conf needed zero changes to run here.
resource "aws_service_discovery_private_dns_namespace" "internal" {
  name = "${var.project_name}.internal"
  vpc  = aws_vpc.main.id
}

resource "aws_cloudwatch_log_group" "backend" {
  name              = "/ecs/${var.project_name}-${var.environment}/backend"
  retention_in_days = var.log_retention_days
}

resource "aws_cloudwatch_log_group" "frontend" {
  name              = "/ecs/${var.project_name}-${var.environment}/frontend"
  retention_in_days = var.log_retention_days
}

locals {
  # ECS rejects a literal "repositoryCredentials": null in the container
  # definition, so this key is merged in only when a GHCR PAT is actually
  # configured (private packages) instead of always being present.
  ghcr_credentials = var.ghcr_pat != "" ? {
    repositoryCredentials = { credentialsParameter = aws_secretsmanager_secret.ghcr_pat[0].arn }
  } : {}
}

resource "aws_ecs_task_definition" "backend" {
  family                   = "${var.project_name}-${var.environment}-backend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.backend_cpu
  memory                   = var.backend_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn

  container_definitions = jsonencode([merge({
    name  = "backend"
    image = "ghcr.io/${var.ghcr_owner}/teamflow-backend:${var.backend_image_tag}"

    portMappings = [{
      name          = "backend"
      containerPort = 8080
      protocol      = "tcp"
    }]

    environment = [
      { name = "DATABASE_URL", value = "jdbc:postgresql://${aws_db_instance.main.endpoint}/${var.db_name}" },
      { name = "DATABASE_USERNAME", value = var.db_username },
      { name = "CORS_ORIGINS", value = "http://${aws_lb.main.dns_name}" },
      { name = "SERVER_PORT", value = "8080" },
    ]

    secrets = [
      { name = "DATABASE_PASSWORD", valueFrom = aws_secretsmanager_secret.db_password.arn },
      { name = "JWT_ACCESS_SECRET", valueFrom = aws_secretsmanager_secret.jwt_access.arn },
      { name = "JWT_REFRESH_SECRET", valueFrom = aws_secretsmanager_secret.jwt_refresh.arn },
    ]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.backend.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "backend"
      }
    }
  }, local.ghcr_credentials)])
}

resource "aws_ecs_task_definition" "frontend" {
  family                   = "${var.project_name}-${var.environment}-frontend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.frontend_cpu
  memory                   = var.frontend_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn

  container_definitions = jsonencode([merge({
    name  = "frontend"
    image = "ghcr.io/${var.ghcr_owner}/teamflow-frontend:${var.frontend_image_tag}"

    portMappings = [{
      name          = "frontend"
      containerPort = 8080
      protocol      = "tcp"
    }]

    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.frontend.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "frontend"
      }
    }
  }, local.ghcr_credentials)])
}

resource "aws_ecs_service" "backend" {
  name            = "backend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.backend.id]
    assign_public_ip = true
  }

  service_connect_configuration {
    enabled   = true
    namespace = aws_service_discovery_private_dns_namespace.internal.arn

    service {
      port_name      = "backend"
      discovery_name = "backend"
      client_alias {
        port = 8080
      }
    }
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  # Flyway migrations run as a separate one-off task (see release.yml) before
  # this service is updated, so a bad migration fails the deploy step instead
  # of surfacing as a half-migrated app flapping behind the circuit breaker.
  lifecycle {
    ignore_changes = [task_definition]
  }
}

resource "aws_ecs_service" "frontend" {
  name            = "frontend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.frontend.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.public[*].id
    security_groups  = [aws_security_group.frontend.id]
    assign_public_ip = true
  }

  service_connect_configuration {
    enabled   = true
    namespace = aws_service_discovery_private_dns_namespace.internal.arn
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.frontend.arn
    container_name   = "frontend"
    container_port   = 8080
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  depends_on = [aws_lb_listener.http]

  lifecycle {
    ignore_changes = [task_definition]
  }
}

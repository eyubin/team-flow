data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# --- ECS task execution role (pulls images, reads secrets, writes logs) ---

data "aws_iam_policy_document" "ecs_task_assume" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "ecs_execution" {
  name               = "${var.project_name}-${var.environment}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_task_assume.json
}

resource "aws_iam_role_policy_attachment" "ecs_execution_managed" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "ecs_execution_secrets" {
  statement {
    actions = ["secretsmanager:GetSecretValue"]
    resources = compact([
      aws_secretsmanager_secret.db_password.arn,
      aws_secretsmanager_secret.jwt_access.arn,
      aws_secretsmanager_secret.jwt_refresh.arn,
      var.ghcr_pat != "" ? aws_secretsmanager_secret.ghcr_pat[0].arn : "",
    ])
  }
}

resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name   = "read-app-secrets"
  role   = aws_iam_role.ecs_execution.id
  policy = data.aws_iam_policy_document.ecs_execution_secrets.json
}

# --- GitHub Actions OIDC federation: no long-lived AWS keys in CI ---

data "tls_certificate" "github_actions" {
  url = "https://token.actions.githubusercontent.com/.well-known/openid-configuration"
}

resource "aws_iam_openid_connect_provider" "github_actions" {
  url             = "https://token.actions.githubusercontent.com"
  client_id_list  = ["sts.amazonaws.com"]
  thumbprint_list = [data.tls_certificate.github_actions.certificates[0].sha1_fingerprint]
}

data "aws_iam_policy_document" "github_actions_assume" {
  statement {
    actions = ["sts:AssumeRoleWithWebIdentity"]
    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github_actions.arn]
    }
    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }
    # Scoped to the release workflow's "staging" GitHub Environment, not just
    # the repo -- a PR from a fork or an unrelated workflow in the same repo
    # cannot assume this role, only a job that declares `environment: staging`.
    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = ["repo:${var.github_repo}:environment:${var.github_environment}"]
    }
  }
}

resource "aws_iam_role" "github_actions_deploy" {
  name               = "${var.project_name}-${var.environment}-github-deploy"
  assume_role_policy = data.aws_iam_policy_document.github_actions_assume.json
}

data "aws_iam_policy_document" "github_actions_deploy" {
  statement {
    sid = "ECSDeploy"
    actions = [
      "ecs:RegisterTaskDefinition",
      "ecs:DescribeTaskDefinition",
      "ecs:DescribeClusters",
    ]
    resources = ["*"] # RegisterTaskDefinition does not support resource-level scoping
  }

  statement {
    sid = "ECSServiceAndTasks"
    actions = [
      "ecs:UpdateService",
      "ecs:DescribeServices",
      "ecs:RunTask",
      "ecs:DescribeTasks",
      "ecs:StopTask",
      "ecs:TagResource",
    ]
    resources = [
      aws_ecs_cluster.main.arn,
      aws_ecs_service.backend.id,
      aws_ecs_service.frontend.id,
      "arn:aws:ecs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:task/${aws_ecs_cluster.main.name}/*",
      "arn:aws:ecs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:task-definition/${var.project_name}-${var.environment}-backend:*",
      "arn:aws:ecs:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:task-definition/${var.project_name}-${var.environment}-frontend:*",
    ]
  }

  statement {
    sid       = "PassTaskRoles"
    actions   = ["iam:PassRole"]
    resources = [aws_iam_role.ecs_execution.arn]
  }

  statement {
    sid       = "ResolveStagingUrl"
    actions   = ["elasticloadbalancing:DescribeLoadBalancers"]
    resources = ["*"] # DescribeLoadBalancers does not support resource-level scoping
  }
}

resource "aws_iam_role_policy" "github_actions_deploy" {
  name   = "deploy-to-ecs"
  role   = aws_iam_role.github_actions_deploy.id
  policy = data.aws_iam_policy_document.github_actions_deploy.json
}

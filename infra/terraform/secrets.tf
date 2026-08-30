# Generated once by Terraform and never echoed to state in plaintext output.
# These mirror the local .env.example values but with real random secrets
# instead of the "change-me" placeholders used for local dev.

resource "random_password" "db" {
  length  = 32
  special = false # RDS master password rejects some special characters
}

resource "random_password" "jwt_access" {
  length  = 48
  special = false
}

resource "random_password" "jwt_refresh" {
  length  = 48
  special = false
}

resource "aws_secretsmanager_secret" "db_password" {
  name                    = "${var.project_name}/${var.environment}/db-password"
  recovery_window_in_days = 0

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db.result
}

resource "aws_secretsmanager_secret" "jwt_access" {
  name                    = "${var.project_name}/${var.environment}/jwt-access-secret"
  recovery_window_in_days = 0

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_secretsmanager_secret_version" "jwt_access" {
  secret_id     = aws_secretsmanager_secret.jwt_access.id
  secret_string = random_password.jwt_access.result
}

resource "aws_secretsmanager_secret" "jwt_refresh" {
  name                    = "${var.project_name}/${var.environment}/jwt-refresh-secret"
  recovery_window_in_days = 0

  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_secretsmanager_secret_version" "jwt_refresh" {
  secret_id     = aws_secretsmanager_secret.jwt_refresh.id
  secret_string = random_password.jwt_refresh.result
}

# Only created when a GHCR PAT is supplied (private packages). Public
# packages -- the recommended default for this project -- need no
# credentials at all, and this resource simply doesn't exist in that case.
resource "aws_secretsmanager_secret" "ghcr_pat" {
  count                   = var.ghcr_pat != "" ? 1 : 0
  name                    = "${var.project_name}/${var.environment}/ghcr-pat"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "ghcr_pat" {
  count     = var.ghcr_pat != "" ? 1 : 0
  secret_id = aws_secretsmanager_secret.ghcr_pat[0].id
  # ECS repositoryCredentials expects a JSON document with these two keys.
  secret_string = jsonencode({
    username = var.ghcr_owner
    password = var.ghcr_pat
  })
}

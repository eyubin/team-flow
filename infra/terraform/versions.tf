terraform {
  required_version = ">= 1.7"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
  }

  # Local state is fine to get started, but state holds RDS/secret ARNs and
  # should not live only on one laptop once more than one person touches
  # staging. Migrate to an S3 backend (with DynamoDB locking) before that
  # happens: `terraform init -migrate-state` after uncommenting a `backend
  # "s3" {}` block here.
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# Terraform configuration for Kiff AI AWS deployment
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Configure the AWS Provider
provider "aws" {
  region = var.aws_region
}

# Data source for current AWS account
data "aws_caller_identity" "current" {}

# Data source for availability zones
data "aws_availability_zones" "available" {
  state = "available"
}

# Random password for RDS
resource "random_password" "db_password" {
  length  = 16
  special = true
}

# ECR Repository for Docker images
resource "aws_ecr_repository" "kiff_ai_backend" {
  name                 = "kiff-ai-backend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = {
    Name        = "kiff-ai-backend"
    Environment = var.environment
  }
}

# ECR Repository Policy
resource "aws_ecr_repository_policy" "kiff_ai_backend_policy" {
  repository = aws_ecr_repository.kiff_ai_backend.name

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowPushPull"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action = [
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:BatchCheckLayerAvailability",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload"
        ]
      }
    ]
  })
}

# VPC for RDS
resource "aws_vpc" "kiff_ai_vpc" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "kiff-ai-vpc"
    Environment = var.environment
  }
}

# Internet Gateway
resource "aws_internet_gateway" "kiff_ai_igw" {
  vpc_id = aws_vpc.kiff_ai_vpc.id

  tags = {
    Name        = "kiff-ai-igw"
    Environment = var.environment
  }
}

# Subnets for RDS (need at least 2 for RDS subnet group)
resource "aws_subnet" "kiff_ai_subnet_1" {
  vpc_id            = aws_vpc.kiff_ai_vpc.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = data.aws_availability_zones.available.names[0]

  tags = {
    Name        = "kiff-ai-subnet-1"
    Environment = var.environment
  }
}

resource "aws_subnet" "kiff_ai_subnet_2" {
  vpc_id            = aws_vpc.kiff_ai_vpc.id
  cidr_block        = "10.0.2.0/24"
  availability_zone = data.aws_availability_zones.available.names[1]

  tags = {
    Name        = "kiff-ai-subnet-2"
    Environment = var.environment
  }
}

# Route table
resource "aws_route_table" "kiff_ai_rt" {
  vpc_id = aws_vpc.kiff_ai_vpc.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.kiff_ai_igw.id
  }

  tags = {
    Name        = "kiff-ai-rt"
    Environment = var.environment
  }
}

# Route table associations
resource "aws_route_table_association" "kiff_ai_rta_1" {
  subnet_id      = aws_subnet.kiff_ai_subnet_1.id
  route_table_id = aws_route_table.kiff_ai_rt.id
}

resource "aws_route_table_association" "kiff_ai_rta_2" {
  subnet_id      = aws_subnet.kiff_ai_subnet_2.id
  route_table_id = aws_route_table.kiff_ai_rt.id
}

# Security group for RDS
resource "aws_security_group" "rds_sg" {
  name_prefix = "kiff-ai-rds-"
  vpc_id      = aws_vpc.kiff_ai_vpc.id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "kiff-ai-rds-sg"
    Environment = var.environment
  }
}

# RDS Subnet Group
resource "aws_db_subnet_group" "kiff_ai_db_subnet_group" {
  name       = "kiff-ai-db-subnet-group"
  subnet_ids = [aws_subnet.kiff_ai_subnet_1.id, aws_subnet.kiff_ai_subnet_2.id]

  tags = {
    Name        = "kiff-ai-db-subnet-group"
    Environment = var.environment
  }
}

# RDS PostgreSQL Database
resource "aws_db_instance" "kiff_ai_db" {
  identifier = "kiff-ai-database"
  
  engine         = "postgres"
  engine_version = "15.7"
  instance_class = "db.t3.micro"  # Free tier eligible
  
  allocated_storage     = 20
  max_allocated_storage = 100
  storage_type          = "gp2"
  storage_encrypted     = true
  
  db_name  = "kiff_ai"
  username = var.db_username
  password = random_password.db_password.result
  
  vpc_security_group_ids = [aws_security_group.rds_sg.id]
  db_subnet_group_name   = aws_db_subnet_group.kiff_ai_db_subnet_group.name
  
  backup_retention_period = 7
  backup_window          = "03:00-04:00"
  maintenance_window     = "sun:04:00-sun:05:00"
  
  skip_final_snapshot = true
  deletion_protection = false
  
  tags = {
    Name        = "kiff-ai-database"
    Environment = var.environment
  }
}

# IAM Role for App Runner
resource "aws_iam_role" "app_runner_role" {
  name = "kiff-ai-app-runner-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "build.apprunner.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name        = "kiff-ai-app-runner-role"
    Environment = var.environment
  }
}

# IAM Policy for ECR access
resource "aws_iam_role_policy_attachment" "app_runner_ecr_policy" {
  role       = aws_iam_role.app_runner_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
}

# Security group for Redis
resource "aws_security_group" "redis_sg" {
  name_prefix = "kiff-ai-redis-"
  vpc_id      = aws_vpc.kiff_ai_vpc.id

  ingress {
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name        = "kiff-ai-redis-sg"
    Environment = var.environment
  }
}

# ElastiCache Subnet Group
resource "aws_elasticache_subnet_group" "kiff_ai_redis_subnet_group" {
  name       = "kiff-ai-redis-subnet-group"
  subnet_ids = [aws_subnet.kiff_ai_subnet_1.id, aws_subnet.kiff_ai_subnet_2.id]

  tags = {
    Name        = "kiff-ai-redis-subnet-group"
    Environment = var.environment
  }
}

# Redis ElastiCache Replication Group
resource "aws_elasticache_replication_group" "kiff_ai_redis" {
  replication_group_id         = "kiff-ai-redis"
  description                  = "Redis cluster for Kiff AI"
  
  node_type                    = "cache.t3.micro"  # Free tier eligible
  port                         = 6379
  parameter_group_name         = "default.redis7"
  
  num_cache_clusters           = 1
  
  subnet_group_name            = aws_elasticache_subnet_group.kiff_ai_redis_subnet_group.name
  security_group_ids           = [aws_security_group.redis_sg.id]
  
  at_rest_encryption_enabled   = true
  transit_encryption_enabled   = false  # Simplified for development
  
  tags = {
    Name        = "kiff-ai-redis"
    Environment = var.environment
  }
}

# App Runner Service
resource "aws_apprunner_service" "kiff_ai_backend" {
  service_name = "kiff-ai-backend"

  source_configuration {
    image_repository {
      image_identifier      = "${aws_ecr_repository.kiff_ai_backend.repository_url}:latest"
      image_configuration {
        port = "8000"
        runtime_environment_variables = {
          # Database Configuration
          DATABASE_URL = "postgresql://${var.db_username}:${random_password.db_password.result}@${aws_db_instance.kiff_ai_db.endpoint}/${aws_db_instance.kiff_ai_db.db_name}"
          REDIS_URL = aws_elasticache_replication_group.kiff_ai_redis.primary_endpoint_address
          
          # LLM API Keys
          OPENAI_API_KEY = var.openai_api_key
          GROQ_API_KEY = var.groq_api_key
          LANGTRACE_API_KEY = var.langtrace_api_key
          NOVITA_API_KEY = var.novita_api_key
          
          # Daytona Sandbox
          DAYTONA_API_URL = var.daytona_api_url
          DAYTONA_API_KEY = var.daytona_api_key
          
          # Security Keys
          JWT_SECRET_KEY = var.jwt_secret_key
          ENCRYPTION_KEY = var.encryption_key
          SECRET_KEY = var.secret_key
          
          # Environment Configuration
          ENVIRONMENT = var.environment
          LOG_LEVEL = var.log_level
          DEBUG = "false"
          ALLOWED_HOSTS = "*"
          
          # Multi-tenant
          DEFAULT_TENANT_ID = var.default_tenant_id
          
          # Email Configuration
          RESEND_API_KEY = var.resend_api_key
          DEFAULT_FROM_EMAIL = var.default_from_email
          FRONTEND_URL = var.frontend_url
          
          # Search API
          EXA_API_KEY = var.exa_api_key
          
          # API Base URL (will be set to the App Runner URL)
          # VITE_API_BASE_URL will be set after deployment
          
          # Stripe Configuration
          STRIPE_PUBLISHABLE_KEY = var.stripe_publishable_key
          STRIPE_SECRET_KEY = var.stripe_secret_key
          STRIPE_WEBHOOK_SECRET = var.stripe_webhook_secret
          STRIPE_PRICE_ID_PRO_MONTHLY = var.stripe_price_id_pro_monthly
        }
      }
      image_repository_type = "ECR"
    }
    auto_deployments_enabled = true
  }

  instance_configuration {
    cpu    = "0.25 vCPU"
    memory = "0.5 GB"
  }

  health_check_configuration {
    healthy_threshold   = 1
    interval            = 10
    path                = "/health"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 5
  }

  tags = {
    Name        = "kiff-ai-backend"
    Environment = var.environment
  }

  depends_on = [aws_db_instance.kiff_ai_db]
}

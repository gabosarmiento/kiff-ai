# Terraform Outputs for Kiff AI AWS Deployment

output "app_runner_service_url" {
  description = "URL of the App Runner service"
  value       = aws_apprunner_service.kiff_ai_backend.service_url
}

output "app_runner_service_arn" {
  description = "ARN of the App Runner service"
  value       = aws_apprunner_service.kiff_ai_backend.arn
}

output "ecr_repository_url" {
  description = "URL of the ECR repository"
  value       = aws_ecr_repository.kiff_ai_backend.repository_url
}

output "database_endpoint" {
  description = "RDS instance endpoint"
  value       = aws_db_instance.kiff_ai_db.endpoint
  sensitive   = true
}

output "database_port" {
  description = "RDS instance port"
  value       = aws_db_instance.kiff_ai_db.port
}

output "database_name" {
  description = "Database name"
  value       = aws_db_instance.kiff_ai_db.db_name
}

output "database_username" {
  description = "Database username"
  value       = aws_db_instance.kiff_ai_db.username
  sensitive   = true
}

output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.kiff_ai_vpc.id
}

output "redis_endpoint" {
  description = "Redis endpoint URL"
  value       = aws_elasticache_replication_group.kiff_ai_redis.primary_endpoint_address
  sensitive   = true
}

output "redis_port" {
  description = "Redis port"
  value       = aws_elasticache_replication_group.kiff_ai_redis.port
}

output "region" {
  description = "AWS region used for deployment"
  value       = var.aws_region
}

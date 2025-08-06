# Terraform Variables for Kiff AI AWS Deployment

variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "eu-west-3"  # Paris region - perfect for you!
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "log_level" {
  description = "Application log level"
  type        = string
  default     = "INFO"
}

# Database Configuration
variable "db_username" {
  description = "Database username"
  type        = string
  default     = "kiff_admin"
}

# Multi-tenant Configuration
variable "default_tenant_id" {
  description = "Default tenant ID for multi-tenant setup"
  type        = string
  default     = "4485db48-71b7-47b0-8128-c6dca5be352d"
}

# LLM API Keys
variable "openai_api_key" {
  description = "OpenAI API key"
  type        = string
  sensitive   = true
}

variable "groq_api_key" {
  description = "Groq API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "langtrace_api_key" {
  description = "LangTrace API key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "novita_api_key" {
  description = "Novita AI API key"
  type        = string
  sensitive   = true
  default     = ""
}

# Daytona Sandbox Configuration
variable "daytona_api_url" {
  description = "Daytona API URL"
  type        = string
  default     = ""
}

variable "daytona_api_key" {
  description = "Daytona API key"
  type        = string
  sensitive   = true
  default     = ""
}

# Security Keys
variable "jwt_secret_key" {
  description = "JWT secret key for authentication"
  type        = string
  sensitive   = true
}

variable "encryption_key" {
  description = "Encryption key for sensitive data"
  type        = string
  sensitive   = true
}

variable "secret_key" {
  description = "General secret key"
  type        = string
  sensitive   = true
}

# Email Configuration
variable "resend_api_key" {
  description = "Resend API key for email services"
  type        = string
  sensitive   = true
  default     = ""
}

variable "default_from_email" {
  description = "Default from email address"
  type        = string
  default     = "noreply@kiff.dev"
}

variable "frontend_url" {
  description = "Frontend URL for CORS and redirects"
  type        = string
  default     = "https://your-frontend-url.vercel.app"
}

# Search API
variable "exa_api_key" {
  description = "Exa API key for search functionality"
  type        = string
  sensitive   = true
  default     = ""
}

# Stripe Configuration
variable "stripe_publishable_key" {
  description = "Stripe publishable key"
  type        = string
  default     = ""
}

variable "stripe_secret_key" {
  description = "Stripe secret key"
  type        = string
  sensitive   = true
  default     = ""
}

variable "stripe_webhook_secret" {
  description = "Stripe webhook secret"
  type        = string
  sensitive   = true
  default     = ""
}

variable "stripe_price_id_pro_monthly" {
  description = "Stripe price ID for pro monthly subscription"
  type        = string
  default     = ""
}

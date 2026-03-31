variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-2"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "prod"
}

variable "account_id" {
  description = "AWS account ID"
  type        = string
  default     = "069171139397"
}

variable "github_owner" {
  description = "GitHub owner"
  type        = string
  default     = "jayhill"
}

variable "github_repo" {
  description = "GitHub repository"
  type        = string
  default     = "watchcircle"
}

variable "deploy_role_name" {
  description = "GitHub deploy role name"
  type        = string
  default     = "watchcircle-prod-github-deploy"
}

variable "ssm_prefix" {
  description = "SSM parameter prefix"
  type        = string
  default     = "/watchcircle"
}

variable "ses_from_email" {
  description = "SES sender email"
  type        = string
  default     = "noreply@watchcircle.net"
}

variable "session_jwt_secret_length" {
  description = "Length for generated session JWT secret"
  type        = number
  default     = 64
}

variable "ws_jwt_secret_length" {
  description = "Length for generated WS JWT secret"
  type        = number
  default     = 64
}

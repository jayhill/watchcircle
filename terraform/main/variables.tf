variable "region" {
  description = "AWS region"
  type        = string
}

variable "environment" {
  description = "Environment name, for example dev or prod"
  type        = string
}

variable "account_id" {
  description = "AWS account ID"
  type        = string
}

variable "github_owner" {
  description = "GitHub owner (user or org)"
  type        = string
}

variable "github_repo" {
  description = "GitHub repository name"
  type        = string
}

variable "deploy_role_name" {
  description = "IAM role name for GitHub deploy role"
  type        = string
}

variable "ssm_prefix" {
  description = "SSM parameter prefix"
  type        = string
  default     = "/watchcircle"
}

variable "ses_from_email" {
  description = "SES sender email to store in SSM"
  type        = string
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

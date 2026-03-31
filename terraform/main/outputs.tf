output "github_actions_oidc_provider_arn" {
  description = "OIDC provider ARN used by GitHub Actions"
  value       = aws_iam_openid_connect_provider.github_actions.arn
}

output "github_deploy_role_arn" {
  description = "IAM role ARN assumed by GitHub Actions"
  value       = aws_iam_role.github_deploy.arn
}

output "github_deploy_policy_arn" {
  description = "IAM policy ARN attached to deploy role"
  value       = aws_iam_policy.github_deploy.arn
}

output "ses_from_email_parameter_name" {
  description = "SSM parameter name for SES sender"
  value       = aws_ssm_parameter.ses_from_email.name
}

output "session_jwt_secret_parameter_name" {
  description = "SSM parameter name for session JWT secret"
  value       = aws_ssm_parameter.session_jwt_secret.name
}

output "ws_jwt_secret_parameter_name" {
  description = "SSM parameter name for WS JWT secret"
  value       = aws_ssm_parameter.ws_jwt_secret.name
}

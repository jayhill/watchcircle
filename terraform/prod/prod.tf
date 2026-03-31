module "main" {
  source = "../main"

  region                    = var.region
  environment               = var.environment
  account_id                = var.account_id
  github_owner              = var.github_owner
  github_repo               = var.github_repo
  deploy_role_name          = var.deploy_role_name
  ssm_prefix                = var.ssm_prefix
  ses_from_email            = var.ses_from_email
  session_jwt_secret_length = var.session_jwt_secret_length
  ws_jwt_secret_length      = var.ws_jwt_secret_length
}

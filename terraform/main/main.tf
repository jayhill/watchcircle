locals {
  oidc_url           = "token.actions.githubusercontent.com"
  ses_from_email_ssm = "${var.ssm_prefix}/${var.environment}/ses-from-email"

  deploy_policy_name = "watchcircle-${var.environment}-github-deploy-policy"

  table_arn       = "arn:aws:dynamodb:${var.region}:${var.account_id}:table/WatchCircle-${var.environment}"
  table_index_arn = "${local.table_arn}/index/*"
  ssm_stage_arn   = "arn:aws:ssm:${var.region}:${var.account_id}:parameter/watchcircle/${var.environment}/*"
}

resource "aws_iam_openid_connect_provider" "github_actions" {
  url = "https://${local.oidc_url}"

  client_id_list = ["sts.amazonaws.com"]

  thumbprint_list = [
    "6938fd4d98bab03faadb97b34396831e3780aea1",
  ]
}

data "aws_iam_policy_document" "github_assume_role" {
  statement {
    effect = "Allow"

    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [aws_iam_openid_connect_provider.github_actions.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "${local.oidc_url}:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringLike"
      variable = "${local.oidc_url}:sub"
      values   = ["repo:${var.github_owner}/${var.github_repo}:*"]
    }
  }
}

resource "aws_iam_role" "github_deploy" {
  name               = var.deploy_role_name
  assume_role_policy = data.aws_iam_policy_document.github_assume_role.json
}

data "aws_iam_policy_document" "github_deploy" {
  statement {
    sid    = "CloudFormationAndStackReads"
    effect = "Allow"
    actions = [
      "cloudformation:CreateChangeSet",
      "cloudformation:CreateStack",
      "cloudformation:DeleteChangeSet",
      "cloudformation:DeleteStack",
      "cloudformation:Describe*",
      "cloudformation:ExecuteChangeSet",
      "cloudformation:Get*",
      "cloudformation:List*",
      "cloudformation:SetStackPolicy",
      "cloudformation:UpdateStack",
      "cloudformation:ValidateTemplate",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "StackServiceRolePass"
    effect = "Allow"
    actions = [
      "iam:PassRole",
    ]
    resources = ["arn:aws:iam::${var.account_id}:role/*"]
  }

  statement {
    sid    = "ManageLambda"
    effect = "Allow"
    actions = [
      "lambda:AddPermission",
      "lambda:CreateFunction",
      "lambda:DeleteFunction",
      "lambda:GetFunction",
      "lambda:GetFunctionConfiguration",
      "lambda:List*",
      "lambda:PublishVersion",
      "lambda:RemovePermission",
      "lambda:TagResource",
      "lambda:UntagResource",
      "lambda:UpdateFunctionCode",
      "lambda:UpdateFunctionConfiguration",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "ManageApiGateway"
    effect = "Allow"
    actions = [
      "apigateway:DELETE",
      "apigateway:GET",
      "apigateway:PATCH",
      "apigateway:POST",
      "apigateway:PUT",
      "apigateway:TagResource",
      "apigateway:UntagResource",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "ManageLogs"
    effect = "Allow"
    actions = [
      "logs:CreateLogGroup",
      "logs:DeleteLogGroup",
      "logs:Describe*",
      "logs:ListTagsLogGroup",
      "logs:PutRetentionPolicy",
      "logs:TagResource",
      "logs:UntagResource",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "ManageEvents"
    effect = "Allow"
    actions = [
      "events:DeleteRule",
      "events:DescribeRule",
      "events:List*",
      "events:PutRule",
      "events:PutTargets",
      "events:RemoveTargets",
      "events:TagResource",
      "events:UntagResource",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "ManageS3Artifacts"
    effect = "Allow"
    actions = [
      "s3:CreateBucket",
      "s3:DeleteBucket",
      "s3:DeleteObject",
      "s3:GetBucketLocation",
      "s3:GetBucketPolicy",
      "s3:GetEncryptionConfiguration",
      "s3:GetObject",
      "s3:ListBucket",
      "s3:ListBucketVersions",
      "s3:PutBucketPolicy",
      "s3:PutBucketTagging",
      "s3:PutEncryptionConfiguration",
      "s3:PutObject",
      "s3:PutBucketVersioning",
      "s3:PutBucketPublicAccessBlock",
      "s3:PutBucketOwnershipControls",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "ManageDynamo"
    effect = "Allow"
    actions = [
      "dynamodb:CreateTable",
      "dynamodb:DeleteTable",
      "dynamodb:DescribeTable",
      "dynamodb:ListTables",
      "dynamodb:TagResource",
      "dynamodb:UntagResource",
      "dynamodb:UpdateTable",
      "dynamodb:GetItem",
      "dynamodb:PutItem",
      "dynamodb:UpdateItem",
      "dynamodb:DeleteItem",
      "dynamodb:Query",
      "dynamodb:Scan",
    ]
    resources = [
      local.table_arn,
      local.table_index_arn,
    ]
  }

  statement {
    sid    = "ManageSsmStageParameters"
    effect = "Allow"
    actions = [
      "ssm:AddTagsToResource",
      "ssm:DeleteParameter",
      "ssm:DeleteParameters",
      "ssm:DescribeParameters",
      "ssm:GetParameter",
      "ssm:GetParameters",
      "ssm:GetParametersByPath",
      "ssm:ListTagsForResource",
      "ssm:PutParameter",
      "ssm:RemoveTagsFromResource",
    ]
    resources = [local.ssm_stage_arn]
  }

  statement {
    sid    = "AllowSesSends"
    effect = "Allow"
    actions = [
      "ses:SendEmail",
      "ses:SendRawEmail",
    ]
    resources = ["*"]
  }

  statement {
    sid    = "AllowApiGatewayManageConnections"
    effect = "Allow"
    actions = [
      "execute-api:ManageConnections",
      "execute-api:Invoke",
    ]
    resources = ["*"]
  }
}

resource "aws_iam_policy" "github_deploy" {
  name   = local.deploy_policy_name
  policy = data.aws_iam_policy_document.github_deploy.json
}

resource "aws_iam_role_policy_attachment" "github_deploy" {
  role       = aws_iam_role.github_deploy.name
  policy_arn = aws_iam_policy.github_deploy.arn
}

resource "random_password" "session_jwt_secret" {
  length           = var.session_jwt_secret_length
  special          = true
  override_special = "-_"
}

resource "random_password" "ws_jwt_secret" {
  length           = var.ws_jwt_secret_length
  special          = true
  override_special = "-_"
}

resource "aws_ssm_parameter" "session_jwt_secret" {
  name      = "${var.ssm_prefix}/${var.environment}/session-jwt-secret"
  type      = "SecureString"
  value     = random_password.session_jwt_secret.result
  overwrite = true
}

resource "aws_ssm_parameter" "ws_jwt_secret" {
  name      = "${var.ssm_prefix}/${var.environment}/ws-jwt-secret"
  type      = "SecureString"
  value     = random_password.ws_jwt_secret.result
  overwrite = true
}

resource "aws_ssm_parameter" "ses_from_email" {
  name      = local.ses_from_email_ssm
  type      = "String"
  value     = var.ses_from_email
  overwrite = true
}

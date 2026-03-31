terraform {
  backend "s3" {
    bucket         = "watchcircle-prod-tf-state"
    key            = "terraform/prod.tfstate"
    region         = "us-east-2"
    encrypt        = true
    dynamodb_table = "watchcircle-prod-tf-locks"
  }
}

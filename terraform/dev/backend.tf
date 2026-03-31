terraform {
  backend "s3" {
    bucket         = "watchcircle-dev-tf-state"
    key            = "terraform/dev.tfstate"
    region         = "us-east-2"
    encrypt        = true
    dynamodb_table = "watchcircle-dev-tf-locks"
  }
}

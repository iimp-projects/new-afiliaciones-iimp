terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Backend remoto PROD: estado separado del de QA (key distinta).
  # Sin credenciales explícitas: cadena estándar del SDK.
  backend "s3" {
    bucket       = "iimp-afiliaciones-terraform-state-564914947461"
    key          = "afiliaciones/prod/terraform.tfstate"
    region       = "us-east-2"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.aws_region
}

# WAF (scope CLOUDFRONT) y el certificado ACM de CloudFront deben residir en
# us-east-1, independientemente de la región del resto de la infraestructura.
provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

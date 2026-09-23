terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Backend remoto QA (bucket S3 dedicado, cifrado, versionado y PAB).
  # Locking nativo del backend S3 (Terraform >= 1.10 lo recomienda; 1.9 lo soporta
  # con `use_lockfile`).
  backend "s3" {
    bucket       = "iimp-afiliaciones-terraform-state-564914947461"
    key          = "afiliaciones/qa/terraform.tfstate"
    region       = "us-east-2"
    encrypt      = true
    use_lockfile = true
  }
}

provider "aws" {
  region = var.aws_region

  # Sin credenciales explícitas: se usa la cadena estándar del AWS SDK
  # (variables de entorno, perfil, rol de instancia/OIDC). No configurar
  # access keys aquí.
}

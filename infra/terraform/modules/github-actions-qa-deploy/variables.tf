variable "resource_prefix" {
  description = "Prefijo de naming para los recursos del pipeline QA."
  type        = string
}

variable "aws_region" {
  description = "Región AWS donde viven ECR, EC2 y el documento SSM de QA."
  type        = string
}

variable "aws_account_id" {
  description = "Cuenta AWS que contiene los recursos QA."
  type        = string
}

variable "github_oidc_subject" {
  description = "Subject OIDC exacto emitido por GitHub para el repositorio y environment QA; no admite comodines."
  type        = string

  validation {
    condition     = var.github_oidc_subject == "repo:iimp-projects@277050971/new-afiliaciones-iimp@1304167655:environment:qa"
    error_message = "github_oidc_subject debe coincidir con el subject inmutable confirmado para iimp-projects/new-afiliaciones-iimp y el environment qa."
  }
}

variable "ecr_repository_arn" {
  description = "ARN del único repositorio ECR publicable por GitHub Actions."
  type        = string
}

variable "ecr_repository_url" {
  description = "URL del repositorio ECR usada para validar IMAGE_URI."
  type        = string
}

variable "qa_instance_arn" {
  description = "ARN de la única instancia QA alcanzable por SendCommand."
  type        = string
}

variable "qa_base_url" {
  description = "URL pública de QA usada por los smoke tests del documento SSM."
  type        = string
}

variable "tags" {
  description = "Tags comunes."
  type        = map(string)
  default     = {}
}

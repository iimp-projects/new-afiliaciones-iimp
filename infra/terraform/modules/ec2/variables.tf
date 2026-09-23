variable "resource_prefix" {
  description = "Prefijo de naming para los recursos."
  type        = string
}

variable "aws_region" {
  description = "Región AWS (para construir ARNs de SSM/ECR)."
  type        = string
}

variable "subnet_id" {
  description = "Subred pública donde se lanza la instancia QA."
  type        = string
}

variable "vpc_id" {
  description = "VPC de la instancia QA (para el Security Group)."
  type        = string
}

variable "instance_type" {
  description = "Tipo de instancia EC2 (x86_64)."
  type        = string
  default     = "t3.small"
}

variable "root_volume_size_gb" {
  description = "Tamaño del volumen raíz (gp3, cifrado)."
  type        = number
  default     = 20
}

variable "data_volume_size_gb" {
  description = "Tamaño del volumen de datos persistente (gp3, cifrado)."
  type        = number
  default     = 30
}

variable "ingress_ports" {
  description = "Puertos públicos permitidos (HTTP/HTTPS)."
  type        = list(number)
  default     = [80, 443]
}

variable "postgres_allowed_cidr" {
  description = "CIDR autorizado para TCP/5432 (acceso directo a PostgreSQL). Vacío deshabilita la regla."
  type        = string
  default     = ""
}

variable "s3_bucket_arn" {
  description = "ARN del bucket S3 QA (documentos y backups)."
  type        = string
}

variable "s3_allowed_prefixes" {
  description = "Prefijos S3 accesibles por la instancia."
  type        = list(string)
  default     = ["afiliaciones/*", "backups/*"]
}

variable "ssm_secure_parameter_arns" {
  description = "ARNs de parámetros SSM SecureString que la instancia puede leer."
  type        = list(string)
  default     = []
}

variable "ecr_repository_arn" {
  description = "ARN del repositorio ECR para pull de imágenes."
  type        = string
}

variable "log_group_name" {
  description = "Nombre del log group de CloudWatch para los logs de la instancia."
  type        = string
}

variable "enable_sns_publish" {
  description = "Otorga sns:Publish (SMS) a la instancia."
  type        = bool
  default     = false
}

variable "user_data" {
  description = "Script de arranque (bootstrap de Docker/Caddy/PostgreSQL)."
  type        = string
  default     = ""
}

variable "tags" {
  description = "Tags comunes."
  type        = map(string)
  default     = {}
}

variable "resource_prefix" {
  description = "Prefijo de naming para los recursos."
  type        = string
}

variable "aws_region" {
  description = "Región AWS (para construir ARNs de CloudWatch Logs)."
  type        = string
}

variable "subnet_ids" {
  description = "Subredes (públicas) donde el ASG lanza las instancias. Dos subredes en AZ distintas para distribución."
  type        = list(string)

  validation {
    condition     = length(var.subnet_ids) >= 2
    error_message = "Se requieren al menos 2 subredes (una por AZ) para alta disponibilidad de la aplicación."
  }
}

variable "app_security_group_id" {
  description = "Security Group de la aplicación (ingreso solo desde el ALB)."
  type        = string
}

variable "target_group_arns" {
  description = "ARNs de los target groups a los que se registran las instancias."
  type        = list(string)
}

variable "ami_id" {
  description = "AMI opcional; si es null se usa Amazon Linux 2023 (parámetro público SSM)."
  type        = string
  default     = null
}

variable "instance_type" {
  description = "Tipo de instancia EC2."
  type        = string
  default     = "t3.small"
}

variable "root_volume_size_gb" {
  description = "Tamaño del volumen raíz (gp3, cifrado)."
  type        = number
  default     = 20
}

variable "user_data" {
  description = "Script de bootstrap (templatefile renderizado). Sin secretos."
  type        = string
}

variable "min_size" {
  description = "Número mínimo de instancias."
  type        = number
  default     = 1
}

variable "max_size" {
  description = "Número máximo de instancias."
  type        = number
  default     = 1
}

variable "desired_capacity" {
  description = "Número deseado de instancias."
  type        = number
  default     = 1
}

variable "health_check_type" {
  description = "Tipo de health check del ASG (EC2 o ELB)."
  type        = string
  default     = "ELB"

  validation {
    condition     = contains(["EC2", "ELB"], var.health_check_type)
    error_message = "health_check_type debe ser EC2 o ELB."
  }
}

variable "health_check_grace_period" {
  description = "Periodo de gracia (segundos) antes de evaluar el health check."
  type        = number
  default     = 300
}

variable "s3_bucket_arn" {
  description = "ARN del bucket S3 de la aplicación."
  type        = string
}

variable "s3_allowed_prefixes" {
  description = "Prefijos S3 accesibles por la instancia."
  type        = list(string)
  default     = ["afiliaciones/*"]
}

variable "ssm_parameter_path_arn" {
  description = "ARN con wildcard del path SSM PROD que la instancia puede leer (GetParametersByPath)."
  type        = string
}

variable "ecr_repository_arn" {
  description = "ARN del repositorio ECR para pull de imágenes."
  type        = string
}

variable "log_group_name" {
  description = "Nombre del log group de CloudWatch."
  type        = string
}

variable "enable_sns_publish" {
  description = "Otorga sns:Publish (SMS) a la instancia."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags comunes."
  type        = map(string)
  default     = {}
}

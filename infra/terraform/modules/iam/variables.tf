variable "resource_prefix" {
  description = "Prefijo de naming para los recursos."
  type        = string
}

variable "s3_bucket_arn" {
  description = "ARN del bucket S3 de la aplicación (para el Task Role)."
  type        = string
}

variable "sns_publish" {
  description = "Otorga sns:Publish al Task Role (SMS directo con PhoneNumber)."
  type        = bool
  default     = true
}

variable "secret_arns" {
  description = "ARNs de secretos que ECS inyecta en la tarea (Execution Role)."
  type        = list(string)
  default     = []
}

variable "enable_database_url_composer" {
  description = "Crea un rol dedicado para componer DATABASE_URL (leer secreto RDS, escribir database-url)."
  type        = bool
  default     = false
}

variable "rds_master_secret_arn" {
  description = "ARN del secreto gestionado por RDS (solo lectura para el compositor)."
  type        = string
  default     = null
}

variable "database_url_secret_arn" {
  description = "ARN del contenedor de secreto DATABASE_URL (escritura para el compositor)."
  type        = string
  default     = null
}

variable "tags" {
  description = "Tags comunes."
  type        = map(string)
  default     = {}
}

variable "resource_prefix" {
  description = "Prefijo de naming para los recursos."
  type        = string
}

variable "db_subnet_ids" {
  description = "Subredes privadas de base de datos (mínimo 2 en distintas AZ)."
  type        = list(string)

  validation {
    condition     = length(var.db_subnet_ids) >= 2
    error_message = "Se requieren al menos 2 subredes para el DB subnet group."
  }
}

variable "rds_security_group_id" {
  description = "Security Group exclusivo de RDS."
  type        = string
}

variable "engine_version" {
  description = "Versión de PostgreSQL (parametrizable)."
  type        = string
  default     = "16"
}

variable "instance_class" {
  description = "Clase de instancia RDS."
  type        = string
  default     = "db.t4g.micro"
}

variable "allocated_storage" {
  description = "Almacenamiento inicial en GB."
  type        = number
  default     = 20
}

variable "max_allocated_storage" {
  description = "Almacenamiento máximo para autoscaling en GB."
  type        = number
  default     = 100
}

variable "storage_type" {
  description = "Tipo de almacenamiento."
  type        = string
  default     = "gp3"
}

variable "multi_az" {
  description = "Habilita Multi-AZ (normalmente false en QA)."
  type        = bool
  default     = false
}

variable "backup_retention_period" {
  description = "Retención de backups en días."
  type        = number
  default     = 7
}

variable "deletion_protection" {
  description = "Protección contra borrado."
  type        = bool
  default     = false
}

variable "skip_final_snapshot" {
  description = "Omite snapshot final al destruir (QA)."
  type        = bool
  default     = true
}

variable "db_name" {
  description = "Nombre de la base de datos inicial."
  type        = string
  default     = "afiliaciones"
}

variable "master_username" {
  description = "Usuario maestro. La contraseña la gestiona RDS en Secrets Manager."
  type        = string
  default     = "afiliaciones_admin"
}

variable "apply_immediately" {
  description = "Aplica cambios inmediatamente (QA)."
  type        = bool
  default     = true
}

variable "tags" {
  description = "Tags comunes."
  type        = map(string)
  default     = {}
}

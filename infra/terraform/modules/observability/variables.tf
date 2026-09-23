variable "resource_prefix" {
  description = "Prefijo de naming para los recursos."
  type        = string
}

variable "log_retention_days" {
  description = "Retención del log group en días."
  type        = number
  default     = 30
}

variable "kms_key_arn" {
  description = "ARN de KMS para cifrar logs (opcional)."
  type        = string
  default     = null
}

variable "tags" {
  description = "Tags comunes."
  type        = map(string)
  default     = {}
}

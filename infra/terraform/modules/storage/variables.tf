variable "resource_prefix" {
  description = "Prefijo de naming para los recursos."
  type        = string
}

variable "versioning_enabled" {
  description = "Habilita versionado del bucket."
  type        = bool
  default     = true
}

variable "lifecycle_expiration_days" {
  description = "Días para expirar versiones no actuales (0 = sin lifecycle)."
  type        = number
  default     = 90
}

variable "enable_cors" {
  description = "Habilita CORS (solo si el navegador accede directamente a S3)."
  type        = bool
  default     = false
}

variable "cors_allowed_origins" {
  description = "Orígenes permitidos para CORS."
  type        = list(string)
  default     = []
}

variable "force_destroy" {
  description = "Permite destruir el bucket con objetos (solo QA)."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags comunes."
  type        = map(string)
  default     = {}
}

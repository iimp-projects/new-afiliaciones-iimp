variable "resource_prefix" {
  description = "Prefijo de naming para los recursos."
  type        = string
}

variable "enable_rate_limit" {
  description = "Habilita la regla rate-based (protección básica de abuso)."
  type        = bool
  default     = true
}

variable "rate_limit" {
  description = "Umbral de solicitudes por IP en la ventana de 5 minutos."
  type        = number
  default     = 1000
}

variable "tags" {
  description = "Tags comunes."
  type        = map(string)
  default     = {}
}

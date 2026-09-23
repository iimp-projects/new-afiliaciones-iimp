variable "resource_prefix" {
  description = "Prefijo de naming para los recursos."
  type        = string
}

variable "secret_names" {
  description = "Mapa lógico de secretos a crear (nombre => descripción). Los VALORES se cargan fuera del repositorio."
  type        = map(string)
  default     = {}
}

variable "recovery_window_in_days" {
  description = "Ventana de recuperación de secretos (0 para QA)."
  type        = number
  default     = 0
}

variable "ssm_parameters" {
  description = "Parámetros no sensibles en SSM Parameter Store (nombre => { value, type, description })."
  type = map(object({
    value       = string
    type        = optional(string, "String")
    description = optional(string, "")
  }))
  default = {}
}

variable "tags" {
  description = "Tags comunes."
  type        = map(string)
  default     = {}
}

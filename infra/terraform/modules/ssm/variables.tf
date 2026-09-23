variable "resource_prefix" {
  description = "Prefijo de naming para los recursos."
  type        = string
}

variable "aws_region" {
  description = "Región AWS (para construir ARNs de parámetros)."
  type        = string
}

variable "parameter_namespace" {
  description = "Namespace de los parámetros QA (por ejemplo: /afiliaciones/qa)."
  type        = string
  default     = "/afiliaciones/qa"
}

variable "parameters" {
  description = "Parámetros NO sensibles a crear (nombre lógico => valor). Tipo String."
  type        = map(string)
  default     = {}
}

variable "secure_parameter_names" {
  description = "Nombres lógicos de parámetros SecureString que se cargan FUERA de Terraform (solo se derivan sus ARNs para IAM)."
  type        = list(string)
  default     = []
}

variable "tags" {
  description = "Tags comunes."
  type        = map(string)
  default     = {}
}

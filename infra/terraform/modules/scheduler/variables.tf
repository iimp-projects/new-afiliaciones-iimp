variable "resource_prefix" {
  description = "Prefijo de naming para los recursos."
  type        = string
}

variable "enable_scheduler" {
  description = "Habilita el arranque/parada automática de la EC2 QA."
  type        = bool
  default     = false
}

variable "instance_id" {
  description = "ID de la instancia EC2 QA."
  type        = string
}

variable "instance_arn" {
  description = "ARN de la instancia EC2 QA (para la política IAM)."
  type        = string
}

variable "start_schedule" {
  description = "Expresión de arranque (EventBridge Scheduler)."
  type        = string
  default     = "cron(0 8 ? * MON-FRI *)"
}

variable "stop_schedule" {
  description = "Expresión de parada (EventBridge Scheduler)."
  type        = string
  default     = "cron(0 20 ? * MON-FRI *)"
}

variable "schedule_timezone" {
  description = "Zona horaria del scheduler."
  type        = string
  default     = "America/Lima"
}

variable "tags" {
  description = "Tags comunes."
  type        = map(string)
  default     = {}
}

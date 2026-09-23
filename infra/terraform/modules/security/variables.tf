variable "resource_prefix" {
  description = "Prefijo de naming para los recursos."
  type        = string
}

variable "vpc_id" {
  description = "ID de la VPC donde se crean los Security Groups."
  type        = string
}

variable "app_port" {
  description = "Puerto de la aplicación en las tareas ECS."
  type        = number
  default     = 3000
}

variable "smtp_egress_ports" {
  description = "Puertos SMTP permitidos como salida desde ECS (según proveedor de correo)."
  type        = list(number)
  default     = [25, 465, 587]
}

variable "tags" {
  description = "Tags comunes."
  type        = map(string)
  default     = {}
}

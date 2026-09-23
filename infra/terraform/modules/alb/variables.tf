variable "resource_prefix" {
  description = "Prefijo de naming para los recursos."
  type        = string
}

variable "vpc_id" {
  description = "ID de la VPC."
  type        = string
}

variable "public_subnet_ids" {
  description = "Subredes públicas para el ALB."
  type        = list(string)
}

variable "alb_security_group_id" {
  description = "Security Group del ALB."
  type        = string
}

variable "app_port" {
  description = "Puerto del contenedor en las tareas ECS."
  type        = number
  default     = 3000
}

variable "health_check_path" {
  description = "Ruta de health check del ALB (liveness)."
  type        = string
  default     = "/api/health/live"
}

variable "enable_https" {
  description = "Habilita listener HTTPS (requiere certificate_arn)."
  type        = bool
  default     = false
}

variable "certificate_arn" {
  description = "ARN del certificado ACM (opcional; no se crea en esta fase)."
  type        = string
  default     = null
}

variable "create_dns_record" {
  description = "Crea un registro Route53 para el ALB (false por defecto)."
  type        = bool
  default     = false
}

variable "hosted_zone_id" {
  description = "ID de la hosted zone para el registro DNS (opcional)."
  type        = string
  default     = null
}

variable "domain_name" {
  description = "Nombre de dominio para el registro DNS (opcional)."
  type        = string
  default     = null
}

variable "tags" {
  description = "Tags comunes."
  type        = map(string)
  default     = {}
}

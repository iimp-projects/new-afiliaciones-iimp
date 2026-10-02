variable "resource_prefix" {
  description = "Prefijo de naming para los recursos."
  type        = string
}

variable "alb_dns_name" {
  description = "DNS del ALB usado como origen."
  type        = string
}

variable "origin_protect_header_name" {
  description = "Nombre del header personalizado que CloudFront envía al ALB."
  type        = string
}

variable "origin_protect_header_value" {
  description = "Valor secreto del header de protección del origen."
  type        = string
  sensitive   = true
}

variable "domain_name" {
  description = "Dominio (alias) del CloudFront. null = sin dominio personalizado (usa *.cloudfront.net)."
  type        = string
  default     = null
}

variable "acm_certificate_arn" {
  description = "ARN del certificado ACM en us-east-1 (requerido para dominio personalizado)."
  type        = string
  default     = null
}

variable "web_acl_id" {
  description = "ARN del Web ACL WAF (scope CLOUDFRONT) a asociar."
  type        = string
  default     = null
}

variable "origin_protocol_policy" {
  description = "Protocolo de conexión CloudFront → ALB (https-only recomendado)."
  type        = string
  default     = "https-only"
}

variable "default_root_object" {
  description = "Objeto raíz por defecto."
  type        = string
  default     = "/"
}

variable "price_class" {
  description = "Clase de precio de CloudFront."
  type        = string
  default     = "PriceClass_100"
}

variable "tags" {
  description = "Tags comunes."
  type        = map(string)
  default     = {}
}

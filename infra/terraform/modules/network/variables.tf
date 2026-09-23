variable "resource_prefix" {
  description = "Prefijo de naming para los recursos (por ejemplo: afiliaciones-qa)."
  type        = string

  validation {
    condition     = can(regex("^[a-z0-9-]+$", var.resource_prefix))
    error_message = "resource_prefix solo puede contener minúsculas, números y guiones."
  }
}

variable "vpc_cidr" {
  description = "CIDR de la VPC dedicada. CIDR_PENDING_ORGANIZATIONAL_CONFIRMATION: confirmar con la organización antes de apply."
  type        = string

  validation {
    condition     = can(cidrnetmask(var.vpc_cidr))
    error_message = "vpc_cidr debe ser un CIDR IPv4 válido."
  }
}

variable "availability_zones" {
  description = "Lista de Availability Zones a utilizar (una entrada por subred)."
  type        = list(string)

  validation {
    condition     = length(var.availability_zones) >= 1
    error_message = "Se requiere al menos 1 Availability Zone."
  }
}

variable "public_subnet_cidrs" {
  description = "CIDRs de las subredes públicas (ALB y NAT)."
  type        = list(string)
}

variable "private_app_subnet_cidrs" {
  description = "CIDRs de las subredes privadas de aplicación (ECS)."
  type        = list(string)
}

variable "private_db_subnet_cidrs" {
  description = "CIDRs de las subredes privadas de base de datos (RDS)."
  type        = list(string)
}

variable "enable_nat_gateway" {
  description = "Habilita NAT Gateway para la salida a Internet de las subredes privadas."
  type        = bool
  default     = true
}

variable "single_nat_gateway" {
  description = "Usa un único NAT Gateway (menor costo, menor resiliencia). Recomendado para QA."
  type        = bool
  default     = true
}

variable "enable_s3_gateway_endpoint" {
  description = "Habilita el VPC endpoint Gateway de S3 (sin costo fijo)."
  type        = bool
  default     = true
}

variable "enable_interface_endpoints" {
  description = "Habilita los VPC endpoints Interface (ECR, Logs, Secrets, SNS). Costo fijo por AZ; diferidos en QA."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags comunes aplicados a todos los recursos del módulo."
  type        = map(string)
  default     = {}
}

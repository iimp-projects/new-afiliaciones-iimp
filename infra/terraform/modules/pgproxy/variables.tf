variable "resource_prefix" {
  description = "Prefijo de naming para los recursos."
  type        = string
}

variable "aws_region" {
  description = "Región AWS del proxy."
  type        = string
}

variable "subnet_id" {
  description = "Subred pública donde se lanza la instancia del proxy."
  type        = string
}

variable "vpc_id" {
  description = "VPC del proxy (para el Security Group)."
  type        = string
}

variable "instance_type" {
  description = "Tipo de instancia EC2 (x86_64)."
  type        = string
  default     = "t3.nano"
}

variable "ami" {
  description = "AMI de la instancia. Se fija para evitar reemplazos por cambios en el AMI 'latest' de AL2023."
  type        = string
  default     = "ami-0d3d85815a9746bc5"
  sensitive   = true
}

variable "root_volume_size_gb" {
  description = "Tamaño del volumen raíz (gp3, cifrado)."
  type        = number
  default     = 8
}

variable "allowed_cidrs" {
  description = "CIDRs autorizados para TCP 5432 (acceso pgAdmin). Vacío deshabilita el ingreso."
  type        = list(string)
  default     = []
}

variable "rds_security_group_id" {
  description = "Security Group de RDS al que el proxy envía tráfico 5432."
  type        = string
}

variable "rds_address" {
  description = "Host del endpoint RDS (destino del proxy)."
  type        = string
}

variable "rds_port" {
  description = "Puerto PostgreSQL (escucha del proxy y destino RDS)."
  type        = number
  default     = 5432
}

variable "tags" {
  description = "Tags comunes."
  type        = map(string)
  default     = {}
}

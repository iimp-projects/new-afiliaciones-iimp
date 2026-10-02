variable "project_name" {
  description = "Nombre del proyecto (usado en el naming)."
  type        = string
  default     = "afiliaciones"
}

variable "environment" {
  description = "Nombre del entorno. Solo se admite 'prod'."
  type        = string
  default     = "prod"

  validation {
    condition     = var.environment == "prod"
    error_message = "Este directorio solo admite el entorno 'prod'."
  }
}

variable "aws_region" {
  description = "Región AWS del entorno PROD."
  type        = string
  default     = "us-east-2"
}

# --- Red ---

variable "vpc_cidr" {
  description = "CIDR de la VPC PROD."
  type        = string
  default     = "10.30.0.0/16"
}

variable "availability_zones" {
  description = "Availability Zones (una por subred)."
  type        = list(string)
  default     = ["us-east-2a", "us-east-2b"]
}

variable "public_subnet_cidrs" {
  description = "CIDRs de las subredes públicas (ALB + EC2)."
  type        = list(string)
  default     = ["10.30.0.0/24", "10.30.1.0/24"]
}

variable "private_db_subnet_cidrs" {
  description = "CIDRs de las subredes privadas de base de datos (RDS)."
  type        = list(string)
  default     = ["10.30.10.0/24", "10.30.11.0/24"]
}

# --- Compute (ASG) ---

variable "instance_type" {
  description = "Tipo de instancia EC2."
  type        = string
  default     = "t3.small"
}

variable "root_volume_size_gb" {
  description = "Tamaño del volumen raíz (gp3, cifrado)."
  type        = number
  default     = 20
}

variable "asg_min_size" {
  description = "Número mínimo de instancias del ASG."
  type        = number
  default     = 2
}

variable "asg_max_size" {
  description = "Número máximo de instancias del ASG."
  type        = number
  default     = 2
}

variable "asg_desired_capacity" {
  description = "Número deseado de instancias del ASG."
  type        = number
  default     = 2
}

variable "app_image_tag" {
  description = "Tag (o digest) inmutable de la imagen ECR a desplegar. Se actualiza en cada deploy. Valor real pendiente."
  type        = string
  default     = "pending"
}

# --- Observabilidad ---

variable "log_retention_days" {
  description = "Retención de CloudWatch Logs (días)."
  type        = number
  default     = 30
}

# --- RDS ---

variable "rds_instance_class" {
  description = "Clase de instancia RDS."
  type        = string
  default     = "db.t4g.micro"
}

variable "rds_allocated_storage" {
  description = "Almacenamiento inicial de RDS (GB)."
  type        = number
  default     = 20
}

variable "rds_max_allocated_storage" {
  description = "Almacenamiento máximo para autoscaling de RDS (GB)."
  type        = number
  default     = 100
}

variable "rds_backup_retention_period" {
  description = "Retención de backups automáticos de RDS (días)."
  type        = number
  default     = 14
}

# --- DNS / ACM (PENDING_APPROVAL) ---

variable "create_dns" {
  description = "Crea certificados ACM, listeners HTTPS y registros Route53. Requiere dominio aprobado."
  type        = bool
  default     = false
}

variable "prod_domain_name" {
  description = "Dominio productivo (PENDING_APPROVAL). Requerido si create_dns=true."
  type        = string
  default     = null
}

variable "hosted_zone_id" {
  description = "ID de la hosted zone Route53 (PENDING_APPROVAL). Requerido si create_dns=true."
  type        = string
  default     = null
}

# --- Seguridad de origen CloudFront → ALB ---

variable "origin_protect_header_value" {
  description = "Valor secreto del header de protección del origen (CloudFront → ALB). Obligatorio para PROD. PENDING_SECURE_INPUT: valor aleatorio de alta entropía."
  type        = string
  sensitive   = true

  validation {
    condition     = var.origin_protect_header_value == null || length(var.origin_protect_header_value) >= 32
    error_message = "origin_protect_header_value debe tener al menos 32 caracteres (valor aleatorio de alta entropía)."
  }
}

# --- WAF ---

variable "enable_waf_rate_limit" {
  description = "Habilita la regla rate-based del WAF."
  type        = bool
  default     = true
}

variable "waf_rate_limit" {
  description = "Umbral de la regla rate-based (solicitudes por IP en 5 min)."
  type        = number
  default     = 1000
}

# --- SSM / Secrets ---

variable "secure_parameter_names" {
  description = "Nombres lógicos de parámetros SecureString cargados FUERA de Terraform (solo se derivan ARNs)."
  type        = list(string)
  default = [
    "auth-secret",
    "payment-auth-secret",
    "jwt-secret",
    "database-url",
    "smtp-pass",
    "sap-password",
    "apis-net-pe-token",
    "whatsapp-access-token",
    "associates-api-password",
    "niubiz-prod-username",
    "niubiz-prod-password",
  ]
}

variable "non_secret_parameters" {
  description = "Parámetros NO sensibles adicionales para SSM Parameter Store."
  type        = map(string)
  default     = {}
}

variable "enable_sns_publish" {
  description = "Otorga sns:Publish (SMS) a la instancia."
  type        = bool
  default     = false
}

variable "additional_tags" {
  description = "Tags adicionales."
  type        = map(string)
  default     = {}
}

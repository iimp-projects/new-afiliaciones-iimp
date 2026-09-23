variable "project_name" {
  description = "Nombre del proyecto (usado en el naming)."
  type        = string
  default     = "afiliaciones"
}

variable "environment" {
  description = "Nombre del entorno. En esta fase solo se admite 'qa'."
  type        = string
  default     = "qa"

  validation {
    condition     = var.environment == "qa"
    error_message = "En esta fase solo existe el entorno 'qa'."
  }
}

variable "aws_region" {
  description = "Región AWS del entorno QA."
  type        = string
  default     = "us-east-2"

  validation {
    condition     = can(regex("^[a-z]{2}-[a-z]+-[0-9]$", var.aws_region))
    error_message = "aws_region debe tener el formato de una región AWS."
  }
}

# --- Red Ultra-Lean: VPC dedicada con una única subred pública ---

variable "vpc_cidr" {
  description = "CIDR de la VPC QA. CIDR_PENDING_ORGANIZATIONAL_CONFIRMATION."
  type        = string
  default     = "10.20.0.0/16"
}

variable "public_subnet_cidr" {
  description = "CIDR de la subred pública QA."
  type        = string
  default     = "10.20.0.0/24"
}

variable "qa_postgres_allowed_cidr" {
  description = "CIDR autorizado para acceso directo TCP/5432 a PostgreSQL QA (vacío = deshabilitado). Cambiar a una IP /32 cuando se disponga de una estable."
  type        = string
  default     = "38.236.105.0/24"
}

variable "availability_zone" {
  description = "Availability Zone única de QA."
  type        = string
  default     = "us-east-2a"
}

# --- Compute ---

variable "instance_type" {
  description = "Tipo de instancia EC2 (x86_64)."
  type        = string
  default     = "t3.small"
}

variable "root_volume_size_gb" {
  description = "Tamaño del volumen raíz (gp3, cifrado)."
  type        = number
  default     = 20
}

variable "data_volume_size_gb" {
  description = "Tamaño del volumen de datos persistente (gp3, cifrado)."
  type        = number
  default     = 30
}

variable "qa_hostname" {
  description = "Hostname público de QA (DNS no creado todavía)."
  type        = string
  default     = "afiliaciones-qa.iimp.org.pe"
}

# --- Observabilidad ---

variable "log_retention_days" {
  description = "Retención de CloudWatch Logs."
  type        = number
  default     = 7
}

# --- Scheduler (horario laboral) ---

variable "enable_scheduler" {
  description = "Habilita el arranque/parada automática de la EC2 QA."
  type        = bool
  default     = false
}

variable "scheduler_timezone" {
  description = "Zona horaria del scheduler."
  type        = string
  default     = "America/Lima"
}

variable "start_schedule" {
  description = "Expresión de arranque (L-V 08:00 America/Lima)."
  type        = string
  default     = "cron(0 8 ? * MON-SAT *)"
}

variable "stop_schedule" {
  description = "Expresión de parada (L-V 20:00 America/Lima)."
  type        = string
  default     = "cron(0 1 ? * TUE-SUN *)"
}

# --- SNS (SMS) ---

variable "enable_sns_publish" {
  description = "Otorga sns:Publish a la instancia (SMS)."
  type        = bool
  default     = false
}

# --- SSM ---

variable "non_secret_parameters" {
  description = "Parámetros NO sensibles adicionales para SSM Parameter Store."
  type        = map(string)
  default     = {}
}

variable "secure_parameter_names" {
  description = "Nombres lógicos de parámetros SecureString cargados FUERA de Terraform."
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
    "niubiz-test-username",
    "niubiz-test-password",
  ]
}

variable "additional_tags" {
  description = "Tags adicionales."
  type        = map(string)
  default     = {}
}

variable "github_oidc_subject" {
  description = "Subject OIDC exacto confirmado para iimp-projects/new-afiliaciones-iimp y el environment qa. Sin default para impedir aplicar un subject supuesto."
  type        = string

  validation {
    condition     = var.github_oidc_subject == "repo:iimp-projects@277050971/new-afiliaciones-iimp@1304167655:environment:qa"
    error_message = "github_oidc_subject debe coincidir con el subject inmutable confirmado para el repositorio y environment qa."
  }
}

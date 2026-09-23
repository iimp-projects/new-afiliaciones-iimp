variable "resource_prefix" {
  description = "Prefijo de naming para los recursos."
  type        = string
}

variable "aws_region" {
  description = "Región AWS (para awslogs)."
  type        = string
}

variable "private_app_subnet_ids" {
  description = "Subredes privadas de aplicación para las tareas."
  type        = list(string)
}

variable "ecs_security_group_id" {
  description = "Security Group de las tareas ECS."
  type        = string
}

variable "target_group_arn" {
  description = "ARN del target group del ALB."
  type        = string
}

variable "container_image" {
  description = "URI de la imagen (ECR) a desplegar."
  type        = string
}

variable "migration_image" {
  description = "Imagen para la tarea one-shot de migración (debe incluir Prisma CLI)."
  type        = string
  default     = null
}

variable "container_port" {
  description = "Puerto del contenedor."
  type        = number
  default     = 3000
}

variable "cpu_architecture" {
  description = "Arquitectura Fargate (X86_64 o ARM64)."
  type        = string
  default     = "X86_64"

  validation {
    condition     = contains(["X86_64", "ARM64"], var.cpu_architecture)
    error_message = "cpu_architecture debe ser X86_64 o ARM64."
  }
}

variable "cpu" {
  description = "CPU de la tarea (unidades Fargate)."
  type        = number
  default     = 1024
}

variable "memory" {
  description = "Memoria de la tarea (MB Fargate)."
  type        = number
  default     = 2048
}

variable "desired_count" {
  description = "Número de tareas deseadas."
  type        = number
  default     = 1
}

variable "execution_role_arn" {
  description = "ARN del ECS Execution Role."
  type        = string
}

variable "task_role_arn" {
  description = "ARN del ECS Task Role."
  type        = string
}

variable "migration_role_arn" {
  description = "ARN del rol para la tarea de migración (execution role de la task de migración)."
  type        = string
  default     = null
}

variable "log_group_name" {
  description = "Nombre del log group de CloudWatch."
  type        = string
}

variable "environment_variables" {
  description = "Variables de entorno NO sensibles."
  type        = map(string)
  default     = {}
}

variable "secret_environment" {
  description = "Variables inyectadas desde Secrets Manager (nombre => ARN del secreto)."
  type        = map(string)
  default     = {}
}

variable "health_check_path" {
  description = "Ruta de liveness para el health check del contenedor."
  type        = string
  default     = "/api/health/live"
}

variable "enable_execute_command" {
  description = "Habilita ECS Exec (requiere permisos SSM). Deshabilitado por defecto."
  type        = bool
  default     = false
}

variable "tags" {
  description = "Tags comunes."
  type        = map(string)
  default     = {}
}

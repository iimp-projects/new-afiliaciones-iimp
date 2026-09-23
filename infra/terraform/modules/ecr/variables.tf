variable "resource_prefix" {
  description = "Prefijo de naming para los recursos."
  type        = string
}

variable "image_tag_mutability" {
  description = "Mutabilidad de tags de imagen (IMMUTABLE recomendado)."
  type        = string
  default     = "IMMUTABLE"

  validation {
    condition     = contains(["MUTABLE", "IMMUTABLE"], var.image_tag_mutability)
    error_message = "image_tag_mutability debe ser MUTABLE o IMMUTABLE."
  }
}

variable "scan_on_push" {
  description = "Escaneo de vulnerabilidades al subir imágenes."
  type        = bool
  default     = true
}

variable "max_image_count" {
  description = "Número máximo de imágenes a retener."
  type        = number
  default     = 10
}

variable "tags" {
  description = "Tags comunes."
  type        = map(string)
  default     = {}
}

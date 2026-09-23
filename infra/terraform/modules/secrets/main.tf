# Contenedores de secretos. Los valores NUNCA se definen aquí: se cargan
# fuera del repositorio (consola, CLI o pipeline con permisos controlados).
resource "aws_secretsmanager_secret" "this" {
  for_each = var.secret_names

  name                    = "${var.resource_prefix}/${each.key}"
  description             = each.value
  recovery_window_in_days = var.recovery_window_in_days

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}/${each.key}"
  })
}

# Parámetros NO sensibles (URLs, flags, timeouts). No almacenar secretos aquí.
resource "aws_ssm_parameter" "this" {
  for_each = var.ssm_parameters

  name        = "/${var.resource_prefix}/${each.key}"
  description = each.value.description
  type        = each.value.type
  value       = each.value.value

  tags = merge(var.tags, {
    Name = "/${var.resource_prefix}/${each.key}"
  })
}

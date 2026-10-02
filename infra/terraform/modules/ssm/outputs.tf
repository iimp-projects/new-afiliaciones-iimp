output "parameter_names" {
  description = "Nombres completos de los parámetros NO sensibles creados."
  value       = { for name, parameter in aws_ssm_parameter.this : name => parameter.name }
}

output "secure_parameter_arns" {
  description = "ARNs de los parámetros SecureString (creados fuera de Terraform)."
  value       = local.secure_parameter_arns
}

output "secure_parameter_names" {
  description = "Nombres completos de los parámetros SecureString esperados."
  value       = [for name in var.secure_parameter_names : "${var.parameter_namespace}/${name}"]
}

output "parameter_path_arn" {
  description = "ARN con wildcard del namespace SSM (para permisos IAM de lectura por path de la instancia)."
  value       = "arn:aws:ssm:${var.aws_region}:${data.aws_caller_identity.current.account_id}:parameter${var.parameter_namespace}/*"
}

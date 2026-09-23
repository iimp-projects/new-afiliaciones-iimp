output "secret_arns" {
  description = "ARNs de los secretos, por nombre lógico."
  value       = { for name, secret in aws_secretsmanager_secret.this : name => secret.arn }
}

output "secret_names" {
  description = "Nombres completos de los secretos, por nombre lógico."
  value       = { for name, secret in aws_secretsmanager_secret.this : name => secret.name }
}

output "ssm_parameter_names" {
  description = "Nombres de los parámetros SSM creados."
  value       = { for name, parameter in aws_ssm_parameter.this : name => parameter.name }
}

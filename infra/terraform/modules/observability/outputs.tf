output "log_group_name" {
  description = "Nombre del log group de la aplicación."
  value       = aws_cloudwatch_log_group.app.name
}

output "log_group_arn" {
  description = "ARN del log group de la aplicación."
  value       = aws_cloudwatch_log_group.app.arn
}

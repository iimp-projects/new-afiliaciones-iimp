output "execution_role_arn" {
  description = "ARN del ECS Execution Role."
  value       = aws_iam_role.execution.arn
}

output "task_role_arn" {
  description = "ARN del ECS Task Role."
  value       = aws_iam_role.task.arn
}

output "migration_role_arn" {
  description = "ARN del rol para la tarea de migración de Prisma."
  value       = aws_iam_role.migration.arn
}

output "database_url_composer_role_arn" {
  description = "ARN del rol de composición de DATABASE_URL (si está habilitado)."
  value       = try(aws_iam_role.composer[0].arn, null)
}

output "cluster_name" {
  description = "Nombre del cluster ECS."
  value       = aws_ecs_cluster.this.name
}

output "cluster_arn" {
  description = "ARN del cluster ECS."
  value       = aws_ecs_cluster.this.arn
}

output "service_name" {
  description = "Nombre del servicio ECS."
  value       = aws_ecs_service.app.name
}

output "task_definition_arn" {
  description = "ARN de la task definition web."
  value       = aws_ecs_task_definition.app.arn
}

output "migration_task_definition_arn" {
  description = "ARN de la task definition de migración (si está habilitada)."
  value       = try(aws_ecs_task_definition.migration[0].arn, null)
}

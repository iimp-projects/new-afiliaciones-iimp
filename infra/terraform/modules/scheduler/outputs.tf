output "start_schedule_arn" {
  description = "ARN del schedule de arranque (si está habilitado)."
  value       = try(aws_scheduler_schedule.start[0].arn, null)
}

output "stop_schedule_arn" {
  description = "ARN del schedule de parada (si está habilitado)."
  value       = try(aws_scheduler_schedule.stop[0].arn, null)
}

output "scheduler_role_arn" {
  description = "ARN del rol del scheduler (si está habilitado)."
  value       = try(aws_iam_role.scheduler[0].arn, null)
}

output "db_instance_id" {
  description = "Identificador de la instancia RDS."
  value       = aws_db_instance.this.id
}

output "db_endpoint" {
  description = "Endpoint de conexión (host:puerto)."
  value       = aws_db_instance.this.endpoint
}

output "db_address" {
  description = "Host de la base de datos."
  value       = aws_db_instance.this.address
}

output "db_port" {
  description = "Puerto de la base de datos."
  value       = aws_db_instance.this.port
}

output "db_name" {
  description = "Nombre de la base de datos."
  value       = aws_db_instance.this.db_name
}

output "master_user_secret_arn" {
  description = "ARN del secreto gestionado por RDS con las credenciales maestras."
  value       = try(aws_db_instance.this.master_user_secret[0].secret_arn, null)
}

output "db_subnet_group_name" {
  description = "Nombre del DB subnet group."
  value       = aws_db_subnet_group.this.name
}

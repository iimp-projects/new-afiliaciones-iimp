output "public_ip" {
  description = "IP pública estable del proxy (para pgAdmin)."
  value       = aws_eip.this.public_ip
}

output "port" {
  description = "Puerto de escucha del proxy."
  value       = var.rds_port
}

output "instance_id" {
  description = "ID de la instancia del proxy."
  value       = aws_instance.this.id
}

output "security_group_id" {
  description = "Security Group del proxy."
  value       = aws_security_group.this.id
}

output "rds_address" {
  description = "Endpoint RDS destino (privado)."
  value       = var.rds_address
}

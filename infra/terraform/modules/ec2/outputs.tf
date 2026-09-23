output "instance_id" {
  description = "ID de la instancia EC2 QA."
  value       = aws_instance.this.id
}

output "instance_arn" {
  description = "ARN de la instancia EC2 QA."
  value       = aws_instance.this.arn
}

output "elastic_ip" {
  description = "Elastic IP asociada a la instancia QA."
  value       = aws_eip.this.public_ip
}

output "security_group_id" {
  description = "Security Group de la instancia QA."
  value       = aws_security_group.ec2.id
}

output "iam_role_arn" {
  description = "ARN del Instance Role."
  value       = aws_iam_role.instance.arn
}

output "data_volume_id" {
  description = "ID del volumen EBS de datos."
  value       = aws_ebs_volume.data.id
}

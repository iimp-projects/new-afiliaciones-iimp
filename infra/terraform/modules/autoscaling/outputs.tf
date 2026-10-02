output "autoscaling_group_id" {
  description = "ID del Auto Scaling Group."
  value       = aws_autoscaling_group.this.id
}

output "autoscaling_group_name" {
  description = "Nombre del Auto Scaling Group."
  value       = aws_autoscaling_group.this.name
}

output "autoscaling_group_arn" {
  description = "ARN del Auto Scaling Group."
  value       = aws_autoscaling_group.this.arn
}

output "launch_template_id" {
  description = "ID del Launch Template."
  value       = aws_launch_template.this.id
}

output "instance_role_arn" {
  description = "ARN del rol de instancia de aplicación."
  value       = aws_iam_role.instance.arn
}

output "instance_profile_name" {
  description = "Nombre del instance profile."
  value       = aws_iam_instance_profile.this.name
}

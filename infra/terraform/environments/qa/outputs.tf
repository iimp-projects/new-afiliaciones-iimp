output "resource_prefix" {
  description = "Prefijo de naming del entorno."
  value       = local.resource_prefix
}

output "qa_url" {
  description = "URL pública prevista de QA (requiere DNS)."
  value       = local.qa_url
}

output "vpc_id" {
  description = "ID de la VPC QA."
  value       = module.network.vpc_id
}

output "public_subnet_id" {
  description = "ID de la subred pública QA."
  value       = module.network.public_subnet_ids[0]
}

output "instance_id" {
  description = "ID de la instancia EC2 QA."
  value       = module.ec2.instance_id
}

output "elastic_ip" {
  description = "Elastic IP de la instancia QA (destino del futuro DNS)."
  value       = module.ec2.elastic_ip
}

output "security_group_id" {
  description = "Security Group de la instancia QA."
  value       = module.ec2.security_group_id
}

output "iam_role_arn" {
  description = "ARN del Instance Role de QA."
  value       = module.ec2.iam_role_arn
}

output "data_volume_id" {
  description = "ID del volumen EBS de datos."
  value       = module.ec2.data_volume_id
}

output "ecr_repository_url" {
  description = "URL del repositorio ECR."
  value       = module.ecr.repository_url
}

output "s3_bucket_name" {
  description = "Nombre del bucket S3 QA."
  value       = module.storage.bucket_name
}

output "log_group_name" {
  description = "Nombre del log group de CloudWatch."
  value       = module.observability.log_group_name
}

output "ssm_parameter_names" {
  description = "Parámetros SSM no sensibles creados."
  value       = module.ssm.parameter_names
}

output "ssm_secure_parameter_names" {
  description = "Nombres de parámetros SecureString esperados (creados fuera de Terraform)."
  value       = module.ssm.secure_parameter_names
}

output "scheduler_start_arn" {
  description = "ARN del schedule de arranque (si está habilitado)."
  value       = module.scheduler.start_schedule_arn
}

output "scheduler_stop_arn" {
  description = "ARN del schedule de parada (si está habilitado)."
  value       = module.scheduler.stop_schedule_arn
}

output "github_actions_qa_deploy_role_arn" {
  description = "ARN para la variable QA_DEPLOY_ROLE_ARN del environment qa en GitHub."
  value       = module.github_actions_qa_deploy.role_arn
}

output "qa_deploy_ssm_document_name" {
  description = "Documento SSM dedicado al rollout app-only de QA."
  value       = module.github_actions_qa_deploy.ssm_document_name
}

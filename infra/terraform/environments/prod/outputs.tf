output "resource_prefix" {
  description = "Prefijo de naming del entorno PROD."
  value       = local.resource_prefix
}

output "vpc_id" {
  description = "ID de la VPC PROD."
  value       = module.network.vpc_id
}

output "public_subnet_ids" {
  description = "IDs de las subredes públicas."
  value       = module.network.public_subnet_ids
}

output "alb_dns_name" {
  description = "DNS nativo del ALB (origen de CloudFront)."
  value       = module.alb.alb_dns_name
}

output "alb_target_group_arn" {
  description = "ARN del target group de la aplicación."
  value       = module.alb.target_group_arn
}

output "autoscaling_group_name" {
  description = "Nombre del Auto Scaling Group."
  value       = module.autoscaling.autoscaling_group_name
}

output "launch_template_id" {
  description = "ID del Launch Template."
  value       = module.autoscaling.launch_template_id
}

output "instance_role_arn" {
  description = "ARN del rol de instancia de aplicación."
  value       = module.autoscaling.instance_role_arn
}

output "rds_endpoint" {
  description = "Endpoint de RDS (host:puerto)."
  value       = module.rds.db_endpoint
}

output "rds_master_secret_arn" {
  description = "ARN del secreto gestionado por RDS con las credenciales maestras."
  value       = module.rds.master_user_secret_arn
}

output "s3_bucket_name" {
  description = "Nombre del bucket S3 PROD."
  value       = module.storage.bucket_name
}

output "ecr_repository_url" {
  description = "URL del repositorio ECR PROD."
  value       = module.ecr.repository_url
}

output "log_group_name" {
  description = "Nombre del log group de CloudWatch."
  value       = module.observability.log_group_name
}

output "cloudfront_domain_name" {
  description = "Dominio de la distribución CloudFront."
  value       = module.cloudfront.distribution_domain_name
}

output "cloudfront_distribution_id" {
  description = "ID de la distribución CloudFront."
  value       = module.cloudfront.distribution_id
}

output "waf_web_acl_arn" {
  description = "ARN del Web ACL WAF (scope CLOUDFRONT)."
  value       = module.waf.web_acl_arn
}

output "ssm_secure_parameter_names" {
  description = "Nombres de parámetros SecureString esperados (creados fuera de Terraform)."
  value       = module.ssm.secure_parameter_names
}

locals {
  resource_prefix     = "${var.project_name}-${var.environment}"
  parameter_namespace = "/${var.project_name}/${var.environment}"

  common_tags = merge(
    {
      Project      = "afiliaciones-iimp"
      Environment  = var.environment
      ManagedBy    = "terraform"
      Application  = "afiliaciones"
      Architecture = "prod-high-availability"
    },
    var.additional_tags,
  )

  non_secret_parameters = merge(
    {
      PAYMENT_PROVIDER    = "NIUBIZ"
      PAYMENT_ENVIRONMENT = "PRODUCTION"
    },
    var.prod_domain_name != null ? {
      AUTH_URL            = "https://${var.prod_domain_name}"
      NEXT_PUBLIC_APP_URL = "https://${var.prod_domain_name}"
    } : {},
    var.non_secret_parameters,
  )
}

# --- Red: VPC + 2 subredes públicas + 2 subredes privadas de BD; sin NAT ---

module "network" {
  source = "../../modules/network"

  resource_prefix            = local.resource_prefix
  vpc_cidr                   = var.vpc_cidr
  availability_zones         = var.availability_zones
  public_subnet_cidrs        = var.public_subnet_cidrs
  private_app_subnet_cidrs   = []
  private_db_subnet_cidrs    = var.private_db_subnet_cidrs
  enable_nat_gateway         = false
  single_nat_gateway         = false
  enable_s3_gateway_endpoint = false
  enable_interface_endpoints = false
  tags                       = local.common_tags
}

# --- Security Groups: ALB / APP / RDS ---

module "security" {
  source = "../../modules/security"

  resource_prefix   = local.resource_prefix
  vpc_id            = module.network.vpc_id
  app_port          = 3000
  smtp_egress_ports = [25, 465, 587]
  tags              = local.common_tags
}

# --- Almacenamiento S3 PROD (separado de QA) ---

module "storage" {
  source = "../../modules/storage"

  resource_prefix           = local.resource_prefix
  versioning_enabled        = true
  lifecycle_expiration_days = 90
  force_destroy             = false
  tags                      = local.common_tags
}

# --- ECR PROD (repositorio separado; imágenes inmutables) ---

module "ecr" {
  source = "../../modules/ecr"

  resource_prefix      = local.resource_prefix
  image_tag_mutability = "IMMUTABLE"
  scan_on_push         = true
  tags                 = local.common_tags
}

# --- Observabilidad: log group ---

module "observability" {
  source = "../../modules/observability"

  resource_prefix    = local.resource_prefix
  log_retention_days = var.log_retention_days
  tags               = local.common_tags
}

# --- SSM: parámetros no sensibles + ARNs de SecureString (creados fuera de Terraform) ---

module "ssm" {
  source = "../../modules/ssm"

  resource_prefix        = local.resource_prefix
  aws_region             = var.aws_region
  parameter_namespace    = local.parameter_namespace
  parameters             = local.non_secret_parameters
  secure_parameter_names = var.secure_parameter_names
  tags                   = local.common_tags
}

# --- RDS PostgreSQL Single-AZ privado ---

module "rds" {
  source = "../../modules/rds"

  resource_prefix         = local.resource_prefix
  db_subnet_ids           = module.network.private_db_subnet_ids
  rds_security_group_id   = module.security.rds_sg_id
  engine_version          = "16"
  instance_class          = var.rds_instance_class
  allocated_storage       = var.rds_allocated_storage
  max_allocated_storage   = var.rds_max_allocated_storage
  multi_az                = false
  backup_retention_period = var.rds_backup_retention_period
  deletion_protection     = true
  skip_final_snapshot     = false
  apply_immediately       = false
  db_name                 = "afiliaciones"
  master_username         = "afiliaciones_admin"
  tags                    = local.common_tags
}

# --- ACM ALB (us-east-2) ---

resource "aws_acm_certificate" "alb" {
  count             = var.create_dns ? 1 : 0
  domain_name       = var.prod_domain_name
  validation_method = "DNS"

  tags = local.common_tags
}

# Ambos certificados (ALB us-east-2 y CloudFront us-east-1) comparten el MISMO
# token de validación DNS para afiliaciones.iimp.org.pe. Se usa un ÚNICO
# aws_route53_record de validación (cloudfront_validation, ya gestionado en state).
resource "aws_acm_certificate_validation" "alb" {
  count                   = var.create_dns ? 1 : 0
  certificate_arn         = aws_acm_certificate.alb[0].arn
  validation_record_fqdns = [aws_route53_record.cloudfront_validation[0].fqdn]
}

# --- ACM CloudFront (us-east-1) ---

resource "aws_acm_certificate" "cloudfront" {
  count             = var.create_dns ? 1 : 0
  provider          = aws.us_east_1
  domain_name       = var.prod_domain_name
  validation_method = "DNS"

  tags = local.common_tags
}

resource "aws_route53_record" "cloudfront_validation" {
  count   = var.create_dns ? 1 : 0
  zone_id = var.hosted_zone_id
  name    = tolist(aws_acm_certificate.cloudfront[0].domain_validation_options)[0].resource_record_name
  type    = tolist(aws_acm_certificate.cloudfront[0].domain_validation_options)[0].resource_record_type
  records = [tolist(aws_acm_certificate.cloudfront[0].domain_validation_options)[0].resource_record_value]
  ttl     = 60
}

resource "aws_acm_certificate_validation" "cloudfront" {
  count                   = var.create_dns ? 1 : 0
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.cloudfront[0].arn
  validation_record_fqdns = [aws_route53_record.cloudfront_validation[0].fqdn]
}

# --- ALB + ACM + protección de origen (CloudFront) ---

module "alb" {
  source = "../../modules/alb"

  resource_prefix             = local.resource_prefix
  vpc_id                      = module.network.vpc_id
  public_subnet_ids           = module.network.public_subnet_ids
  alb_security_group_id       = module.security.alb_sg_id
  app_port                    = 3000
  health_check_path           = "/api/health/live"
  enable_https                = var.create_dns
  certificate_arn             = var.create_dns ? aws_acm_certificate.alb[0].arn : null
  create_dns_record           = false
  origin_protect_header_name  = "x-origin-verify"
  origin_protect_header_value = var.origin_protect_header_value
  tags                        = local.common_tags
}

# --- WAF (us-east-1, scope CLOUDFRONT) ---

module "waf" {
  source = "../../modules/waf"
  providers = {
    aws = aws.us_east_1
  }

  resource_prefix   = local.resource_prefix
  enable_rate_limit = var.enable_waf_rate_limit
  rate_limit        = var.waf_rate_limit
  tags              = local.common_tags
}

# --- CloudFront (entrada HTTPS + WAF + no-index) ---

module "cloudfront" {
  source = "../../modules/cloudfront"

  resource_prefix             = local.resource_prefix
  alb_dns_name                = module.alb.alb_dns_name
  origin_protect_header_name  = "x-origin-verify"
  origin_protect_header_value = var.origin_protect_header_value
  origin_protocol_policy      = var.create_dns ? "https-only" : "http-only"
  domain_name                 = var.create_dns ? var.prod_domain_name : null
  acm_certificate_arn         = var.create_dns ? aws_acm_certificate.cloudfront[0].arn : null
  web_acl_id                  = module.waf.web_acl_arn
  tags                        = local.common_tags
}

# --- ASG + Launch Template + rol de instancia ---

module "autoscaling" {
  source = "../../modules/autoscaling"

  resource_prefix           = local.resource_prefix
  aws_region                = var.aws_region
  subnet_ids                = module.network.public_subnet_ids
  app_security_group_id     = module.security.ecs_sg_id
  target_group_arns         = [module.alb.target_group_arn]
  instance_type             = var.instance_type
  root_volume_size_gb       = var.root_volume_size_gb
  min_size                  = var.asg_min_size
  max_size                  = var.asg_max_size
  desired_capacity          = var.asg_desired_capacity
  health_check_type         = "ELB"
  health_check_grace_period = 300
  s3_bucket_arn             = module.storage.bucket_arn
  ssm_parameter_path_arn    = module.ssm.parameter_path_arn
  ecr_repository_arn        = module.ecr.repository_arn
  log_group_name            = module.observability.log_group_name
  enable_sns_publish        = var.enable_sns_publish

  user_data = templatefile("${path.module}/user_data.sh.tpl", {
    region              = var.aws_region
    parameter_namespace = local.parameter_namespace
    bucket              = module.storage.bucket_name
    ecr_repository_url  = module.ecr.repository_url
    image_tag           = var.app_image_tag
    app_port            = 3000
    registry            = split("/", module.ecr.repository_url)[0]
  })

  tags = local.common_tags
}

# --- Registro DNS → CloudFront ---

resource "aws_route53_record" "app" {
  count   = var.create_dns ? 1 : 0
  zone_id = var.hosted_zone_id
  name    = var.prod_domain_name
  type    = "A"

  alias {
    name                   = module.cloudfront.distribution_domain_name
    zone_id                = module.cloudfront.distribution_hosted_zone_id
    evaluate_target_health = false
  }
}

# --- Alarmas CloudWatch mínimas ---

locals {
  alb_arn_suffix = element(split(":loadbalancer/", module.alb.alb_arn), 1)
  tg_arn_suffix  = element(split(":targetgroup/", module.alb.target_group_arn), 1)
}

resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  alarm_name          = "${local.resource_prefix}-alb-5xx"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  threshold           = 5
  period              = 60
  statistic           = "Sum"
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"

  dimensions = {
    LoadBalancer = local.alb_arn_suffix
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "unhealthy_hosts" {
  alarm_name          = "${local.resource_prefix}-unhealthy-hosts"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  threshold           = 1
  period              = 60
  statistic           = "Average"
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"

  dimensions = {
    TargetGroup  = local.tg_arn_suffix
    LoadBalancer = local.alb_arn_suffix
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "rds_cpu" {
  alarm_name          = "${local.resource_prefix}-rds-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  threshold           = 80
  period              = 60
  statistic           = "Average"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"

  dimensions = {
    DBInstanceIdentifier = module.rds.db_instance_id
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "rds_free_storage" {
  alarm_name          = "${local.resource_prefix}-rds-free-storage"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 2
  threshold           = 2000000000
  period              = 60
  statistic           = "Average"
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"

  dimensions = {
    DBInstanceIdentifier = module.rds.db_instance_id
  }

  tags = local.common_tags
}

resource "aws_cloudwatch_metric_alarm" "rds_connections" {
  alarm_name          = "${local.resource_prefix}-rds-connections"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  threshold           = 50
  period              = 60
  statistic           = "Average"
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"

  dimensions = {
    DBInstanceIdentifier = module.rds.db_instance_id
  }

  tags = local.common_tags
}

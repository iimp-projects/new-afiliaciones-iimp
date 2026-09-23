locals {
  resource_prefix     = "${var.project_name}-${var.environment}"
  parameter_namespace = "/${var.project_name}/${var.environment}"
  qa_url              = "https://${var.qa_hostname}"

  common_tags = merge(
    {
      Project      = "afiliaciones-iimp"
      Environment  = var.environment
      ManagedBy    = "terraform"
      Application  = "afiliaciones"
      Architecture = "ultra-lean-qa"
    },
    var.additional_tags,
  )

  non_secret_parameters = merge(
    {
      AUTH_URL              = local.qa_url
      NEXT_PUBLIC_APP_URL   = local.qa_url
      AWS_DEFAULT_REGION    = var.aws_region
      PAYMENT_PROVIDER      = "MOCK"
      PAYMENT_ENVIRONMENT   = "TEST"
      PAYMENT_MOCK_SCENARIO = "PAID"
      PAYMENT_TEST_AMOUNT   = "300.00"
    },
    var.non_secret_parameters,
  )
}

# --- Red Ultra-Lean: VPC + una subred pública; sin NAT ni endpoints ---

module "network" {
  source = "../../modules/network"

  resource_prefix            = local.resource_prefix
  vpc_cidr                   = var.vpc_cidr
  availability_zones         = [var.availability_zone]
  public_subnet_cidrs        = [var.public_subnet_cidr]
  private_app_subnet_cidrs   = []
  private_db_subnet_cidrs    = []
  enable_nat_gateway         = false
  single_nat_gateway         = false
  enable_s3_gateway_endpoint = false
  enable_interface_endpoints = false
  tags                       = local.common_tags
}

# --- Almacenamiento (documentos + backups) ---

module "storage" {
  source = "../../modules/storage"

  resource_prefix = local.resource_prefix
  tags            = local.common_tags
}

# --- ECR (imágenes) ---

module "ecr" {
  source = "../../modules/ecr"

  resource_prefix = local.resource_prefix
  tags            = local.common_tags
}

# --- Observabilidad (CloudWatch 7 días) ---

module "observability" {
  source = "../../modules/observability"

  resource_prefix    = local.resource_prefix
  log_retention_days = var.log_retention_days
  tags               = local.common_tags
}

# --- SSM Parameter Store (config no sensible + contrato de secretos) ---

module "ssm" {
  source = "../../modules/ssm"

  resource_prefix        = local.resource_prefix
  aws_region             = var.aws_region
  parameter_namespace    = local.parameter_namespace
  parameters             = local.non_secret_parameters
  secure_parameter_names = var.secure_parameter_names
  tags                   = local.common_tags
}

# --- EC2 QA (Caddy + Docker + PostgreSQL local) ---

module "ec2" {
  source = "../../modules/ec2"

  resource_prefix     = local.resource_prefix
  aws_region          = var.aws_region
  subnet_id           = module.network.public_subnet_ids[0]
  vpc_id              = module.network.vpc_id
  instance_type       = var.instance_type
  root_volume_size_gb = var.root_volume_size_gb
  data_volume_size_gb = var.data_volume_size_gb

  s3_bucket_arn             = module.storage.bucket_arn
  ssm_secure_parameter_arns = module.ssm.secure_parameter_arns
  ecr_repository_arn        = module.ecr.repository_arn
  log_group_name            = module.observability.log_group_name
  enable_sns_publish        = var.enable_sns_publish
  postgres_allowed_cidr     = var.qa_postgres_allowed_cidr

  user_data = templatefile("${path.module}/user_data.sh.tpl", {
    qa_hostname = var.qa_hostname
    aws_region  = var.aws_region
    bucket      = module.storage.bucket_name
    namespace   = local.parameter_namespace
  })

  tags = local.common_tags
}

# --- GitHub Actions: OIDC + publicación ECR + deployment app-only por SSM ---

data "aws_caller_identity" "current" {}

module "github_actions_qa_deploy" {
  source = "../../modules/github-actions-qa-deploy"

  resource_prefix     = local.resource_prefix
  aws_region          = var.aws_region
  aws_account_id      = data.aws_caller_identity.current.account_id
  github_oidc_subject = var.github_oidc_subject
  ecr_repository_arn  = module.ecr.repository_arn
  ecr_repository_url  = module.ecr.repository_url
  qa_instance_arn     = module.ec2.instance_arn
  qa_base_url         = local.qa_url
  tags                = local.common_tags
}

# --- Scheduler (L-V 08:00-20:00 America/Lima), deshabilitado por defecto ---

module "scheduler" {
  source = "../../modules/scheduler"

  resource_prefix   = local.resource_prefix
  enable_scheduler  = var.enable_scheduler
  instance_id       = module.ec2.instance_id
  instance_arn      = module.ec2.instance_arn
  start_schedule    = var.start_schedule
  stop_schedule     = var.stop_schedule
  schedule_timezone = var.scheduler_timezone
  tags              = local.common_tags
}

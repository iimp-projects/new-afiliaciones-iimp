resource "aws_db_subnet_group" "this" {
  name       = "${var.resource_prefix}-db-subnets"
  subnet_ids = var.db_subnet_ids

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-db-subnets"
  })
}

resource "aws_db_instance" "this" {
  identifier = "${var.resource_prefix}-rds"

  engine         = "postgres"
  engine_version = var.engine_version
  instance_class = var.instance_class

  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage
  storage_type          = var.storage_type
  storage_encrypted     = true

  db_name  = var.db_name
  username = var.master_username

  # RDS gestiona la contraseña en Secrets Manager: nunca se define en Terraform.
  manage_master_user_password = true

  db_subnet_group_name   = aws_db_subnet_group.this.name
  vpc_security_group_ids = [var.rds_security_group_id]
  publicly_accessible    = false

  multi_az                = var.multi_az
  backup_retention_period = var.backup_retention_period
  deletion_protection     = var.deletion_protection
  skip_final_snapshot     = var.skip_final_snapshot
  apply_immediately       = var.apply_immediately

  auto_minor_version_upgrade = true

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-rds"
  })
}

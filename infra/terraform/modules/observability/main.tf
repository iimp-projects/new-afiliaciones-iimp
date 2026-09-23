resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/${var.resource_prefix}-app"
  retention_in_days = var.log_retention_days
  kms_key_id        = var.kms_key_arn

  tags = merge(var.tags, {
    Name = "/ecs/${var.resource_prefix}-app"
  })
}

data "aws_iam_policy_document" "scheduler_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["scheduler.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "scheduler" {
  count = var.enable_scheduler ? 1 : 0

  name               = "${var.resource_prefix}-scheduler-role"
  assume_role_policy = data.aws_iam_policy_document.scheduler_assume.json

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-scheduler-role"
  })
}

data "aws_iam_policy_document" "scheduler" {
  count = var.enable_scheduler ? 1 : 0

  statement {
    sid    = "StartStopQaInstance"
    effect = "Allow"
    actions = [
      "ec2:StartInstances",
      "ec2:StopInstances",
    ]
    resources = [var.instance_arn]
  }
}

resource "aws_iam_role_policy" "scheduler" {
  count = var.enable_scheduler ? 1 : 0

  name   = "${var.resource_prefix}-scheduler-policy"
  role   = aws_iam_role.scheduler[0].id
  policy = data.aws_iam_policy_document.scheduler[0].json
}

resource "aws_scheduler_schedule" "start" {
  count = var.enable_scheduler ? 1 : 0

  name        = "${var.resource_prefix}-start"
  description = "Arranque QA (L-V 08:00 America/Lima)"
  group_name  = "default"

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression          = var.start_schedule
  schedule_expression_timezone = var.schedule_timezone

  target {
    arn      = "arn:aws:scheduler:::aws-sdk:ec2:startInstances"
    role_arn = aws_iam_role.scheduler[0].arn
    input    = jsonencode({ InstanceIds = [var.instance_id] })
  }
}

resource "aws_scheduler_schedule" "stop" {
  count = var.enable_scheduler ? 1 : 0

  name        = "${var.resource_prefix}-stop"
  description = "Parada QA (L-V 20:00 America/Lima)"
  group_name  = "default"

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression          = var.stop_schedule
  schedule_expression_timezone = var.schedule_timezone

  target {
    arn      = "arn:aws:scheduler:::aws-sdk:ec2:stopInstances"
    role_arn = aws_iam_role.scheduler[0].arn
    input    = jsonencode({ InstanceIds = [var.instance_id] })
  }
}

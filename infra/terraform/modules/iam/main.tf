data "aws_caller_identity" "current" {}

data "aws_iam_policy_document" "ecs_tasks_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

# --- Execution Role: pull de ECR, logs y recuperación de secretos inyectados ---

resource "aws_iam_role" "execution" {
  name               = "${var.resource_prefix}-ecs-execution"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-ecs-execution"
  })
}

resource "aws_iam_role_policy_attachment" "execution_managed" {
  role       = aws_iam_role.execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "execution_secrets" {
  count = length(var.secret_arns) > 0 ? 1 : 0

  statement {
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = var.secret_arns
  }
}

resource "aws_iam_role_policy" "execution_secrets" {
  count = length(var.secret_arns) > 0 ? 1 : 0

  name   = "${var.resource_prefix}-execution-secrets"
  role   = aws_iam_role.execution.id
  policy = data.aws_iam_policy_document.execution_secrets[0].json
}

# --- Task Role: permisos de aplicación (S3 y SNS) ---

resource "aws_iam_role" "task" {
  name               = "${var.resource_prefix}-ecs-task"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-ecs-task"
  })
}

data "aws_iam_policy_document" "task" {
  statement {
    sid    = "S3ObjectAccess"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
    ]
    resources = ["${var.s3_bucket_arn}/afiliaciones/*"]
  }

  dynamic "statement" {
    for_each = var.sns_publish ? [1] : []

    content {
      sid       = "SnsSmsPublish"
      effect    = "Allow"
      actions   = ["sns:Publish"]
      resources = ["*"] # SMS directo con PhoneNumber no admite ARN de topic.
    }
  }
}

resource "aws_iam_role_policy" "task" {
  name   = "${var.resource_prefix}-task-policy"
  role   = aws_iam_role.task.id
  policy = data.aws_iam_policy_document.task.json
}

# --- Migration Role: ejecución de `prisma migrate deploy` (one-shot) ---

resource "aws_iam_role" "migration" {
  name               = "${var.resource_prefix}-migration"
  assume_role_policy = data.aws_iam_policy_document.ecs_tasks_assume.json

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-migration"
  })
}

resource "aws_iam_role_policy_attachment" "migration_execution" {
  role       = aws_iam_role.migration.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

data "aws_iam_policy_document" "migration_secrets" {
  count = length(var.secret_arns) > 0 ? 1 : 0

  statement {
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = var.secret_arns
  }
}

resource "aws_iam_role_policy" "migration_secrets" {
  count = length(var.secret_arns) > 0 ? 1 : 0

  name   = "${var.resource_prefix}-migration-secrets"
  role   = aws_iam_role.migration.id
  policy = data.aws_iam_policy_document.migration_secrets[0].json
}

# --- Rol de composición de DATABASE_URL (post-apply, fuera de ECS) ---
# Lee las credenciales del secreto gestionado por RDS y escribe la URL compuesta
# en el contenedor `database-url`. ECS no necesita leer el secreto de RDS.

data "aws_iam_policy_document" "composer_assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"]
    }
  }
}

resource "aws_iam_role" "composer" {
  count = var.enable_database_url_composer ? 1 : 0

  name               = "${var.resource_prefix}-database-url-composer"
  assume_role_policy = data.aws_iam_policy_document.composer_assume.json

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-database-url-composer"
  })
}

data "aws_iam_policy_document" "composer" {
  # count solo con valores conocidos en plan; los ARN se resuelven en apply.
  count = var.enable_database_url_composer ? 1 : 0

  statement {
    sid       = "ReadRdsManagedSecret"
    effect    = "Allow"
    actions   = ["secretsmanager:GetSecretValue"]
    resources = [var.rds_master_secret_arn]
  }

  statement {
    sid       = "WriteDatabaseUrlSecret"
    effect    = "Allow"
    actions   = ["secretsmanager:PutSecretValue", "secretsmanager:UpdateSecret"]
    resources = [var.database_url_secret_arn]
  }
}

resource "aws_iam_role_policy" "composer" {
  count = var.enable_database_url_composer ? 1 : 0

  name   = "${var.resource_prefix}-database-url-composer"
  role   = aws_iam_role.composer[0].id
  policy = data.aws_iam_policy_document.composer[0].json
}

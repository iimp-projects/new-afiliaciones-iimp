data "aws_caller_identity" "current" {}

# AMI oficial Amazon Linux 2023 (x86_64) vía parámetro público de SSM.
data "aws_ssm_parameter" "al2023" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

# --- Security Group: solo 80/443 público; sin 22/3000/5432 ---

resource "aws_security_group" "ec2" {
  name        = "${var.resource_prefix}-ec2-sg"
  description = "QA: HTTP/HTTPS publicos; administracion por SSM (sin SSH)"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-ec2-sg"
  })
}

resource "aws_vpc_security_group_ingress_rule" "public" {
  for_each = toset([for p in var.ingress_ports : tostring(p)])

  security_group_id = aws_security_group.ec2.id
  description       = "Ingreso publico QA"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = tonumber(each.value)
  to_port           = tonumber(each.value)
  ip_protocol       = "tcp"
}

# Acceso directo a PostgreSQL (pgAdmin). Deshabilitado si el CIDR está vacío.
# El control principal es este CIDR acotado (nunca 0.0.0.0/0).
resource "aws_vpc_security_group_ingress_rule" "postgres_admin" {
  for_each = var.postgres_allowed_cidr == "" ? toset([]) : toset([var.postgres_allowed_cidr])

  security_group_id = aws_security_group.ec2.id
  description       = "QA PostgreSQL pgAdmin restricted NAT pool"
  cidr_ipv4         = each.value
  from_port         = 5432
  to_port           = 5432
  ip_protocol       = "tcp"
}

# Egress amplio: la instancia necesita alcanzar AWS APIs, Let's Encrypt, SMTP,
# SAP, Niubiz, WhatsApp, APIS.NET.PE y SIE (IPs dinamicas no conocidas).
resource "aws_vpc_security_group_egress_rule" "all" {
  security_group_id = aws_security_group.ec2.id
  description       = "Egress de salida (AWS + integraciones externas)"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

# --- IAM Instance Role (least privilege) ---

data "aws_iam_policy_document" "assume" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRole"]

    principals {
      type        = "Service"
      identifiers = ["ec2.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "instance" {
  name               = "${var.resource_prefix}-ec2-role"
  assume_role_policy = data.aws_iam_policy_document.assume.json

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-ec2-role"
  })
}

resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.instance.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

data "aws_iam_policy_document" "instance" {
  statement {
    sid    = "S3Objects"
    effect = "Allow"
    actions = [
      "s3:GetObject",
      "s3:PutObject",
    ]
    resources = [for prefix in var.s3_allowed_prefixes : "${var.s3_bucket_arn}/${prefix}"]
  }

  statement {
    sid    = "S3ListBucket"
    effect = "Allow"
    actions = [
      "s3:ListBucket",
    ]
    resources = [var.s3_bucket_arn]
  }

  dynamic "statement" {
    for_each = length(var.ssm_secure_parameter_arns) > 0 ? [1] : []

    content {
      sid    = "SsmParameters"
      effect = "Allow"
      actions = [
        "ssm:GetParameter",
        "ssm:GetParameters",
        "ssm:GetParametersByPath",
      ]
      resources = var.ssm_secure_parameter_arns
    }
  }

  statement {
    sid    = "CloudWatchLogs"
    effect = "Allow"
    actions = [
      "logs:CreateLogStream",
      "logs:PutLogEvents",
      "logs:DescribeLogStreams",
    ]
    resources = ["arn:aws:logs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:log-group:${var.log_group_name}:*"]
  }

  statement {
    sid    = "EcrPull"
    effect = "Allow"
    actions = [
      "ecr:GetDownloadUrlForLayer",
      "ecr:BatchGetImage",
      "ecr:BatchCheckLayerAvailability",
    ]
    resources = [var.ecr_repository_arn]
  }

  statement {
    sid       = "EcrAuth"
    effect    = "Allow"
    actions   = ["ecr:GetAuthorizationToken"]
    resources = ["*"] # GetAuthorizationToken no admite ARN de repositorio.
  }

  dynamic "statement" {
    for_each = var.enable_sns_publish ? [1] : []

    content {
      sid       = "SnsPublish"
      effect    = "Allow"
      actions   = ["sns:Publish"]
      resources = ["*"] # SMS directo con PhoneNumber no admite ARN de topic.
    }
  }
}

resource "aws_iam_role_policy" "instance" {
  name   = "${var.resource_prefix}-ec2-policy"
  role   = aws_iam_role.instance.id
  policy = data.aws_iam_policy_document.instance.json
}

resource "aws_iam_instance_profile" "this" {
  name = "${var.resource_prefix}-ec2-profile"
  role = aws_iam_role.instance.name
}

# --- Instancia EC2 ---

resource "aws_instance" "this" {
  ami                    = data.aws_ssm_parameter.al2023.value
  instance_type          = var.instance_type
  subnet_id              = var.subnet_id
  vpc_security_group_ids = [aws_security_group.ec2.id]
  iam_instance_profile   = aws_iam_instance_profile.this.name

  associate_public_ip_address = false
  user_data                   = var.user_data
  user_data_replace_on_change = true

  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.root_volume_size_gb
    encrypted             = true
    delete_on_termination = true
  }

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required" # IMDSv2 obligatorio
  }

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-ec2"
  })

  # La asociación de una Elastic IP hace que la API reporte un IP pública y
  # Terraform detecte drift contra `associate_public_ip_address = false`,
  # proponiendo reemplazar la instancia (y en cascada el volumen de datos).
  # Se ignora ese atributo para evitar destrucción/recreación no deseada.
  lifecycle {
    ignore_changes = [associate_public_ip_address]
  }
}

# --- Volumen de datos persistente (PostgreSQL / Docker / backups) ---
# Se gestiona como recurso independiente: NO se elimina al terminar la instancia.
resource "aws_ebs_volume" "data" {
  availability_zone = aws_instance.this.availability_zone
  size              = var.data_volume_size_gb
  type              = "gp3"
  encrypted         = true

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-data"
  })
}

resource "aws_volume_attachment" "data" {
  device_name = "/dev/sdf"
  volume_id   = aws_ebs_volume.data.id
  instance_id = aws_instance.this.id
}

# --- Elastic IP (estable ante stop/start; DNS futuro) ---

resource "aws_eip" "this" {
  domain = "vpc"

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-eip"
  })
}

resource "aws_eip_association" "this" {
  instance_id   = aws_instance.this.id
  allocation_id = aws_eip.this.id
}

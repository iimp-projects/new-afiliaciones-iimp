data "aws_ssm_parameter" "al2023" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64"
}

# --- Security Group: solo 5432 desde las IPs autorizadas ---
resource "aws_security_group" "this" {
  name        = "${var.resource_prefix}-pgproxy-sg"
  description = "Proxy TCP PostgreSQL (pgAdmin) - solo IP autorizada"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-pgproxy-sg"
  })
}

resource "aws_vpc_security_group_ingress_rule" "pgadmin" {
  for_each = toset(var.allowed_cidrs)

  security_group_id = aws_security_group.this.id
  description       = "PostgreSQL desde pgAdmin (IP autorizada)"
  cidr_ipv4         = each.value
  from_port         = var.rds_port
  to_port           = var.rds_port
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "to_rds" {
  security_group_id            = aws_security_group.this.id
  description                  = "Proxy hacia PostgreSQL RDS"
  referenced_security_group_id = var.rds_security_group_id
  from_port                    = var.rds_port
  to_port                      = var.rds_port
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "https" {
  security_group_id = aws_security_group.this.id
  description       = "Salida HTTPS (dnf/actualizaciones)"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}

# Regla en el SG de RDS: permite 5432 desde el proxy (referencia por SG).
resource "aws_vpc_security_group_ingress_rule" "rds_from_proxy" {
  security_group_id            = var.rds_security_group_id
  description                  = "PostgreSQL desde el proxy pgAdmin"
  referenced_security_group_id = aws_security_group.this.id
  from_port                    = var.rds_port
  to_port                      = var.rds_port
  ip_protocol                  = "tcp"
}

# --- IAM Instance Role (SSM, least privilege; sin secretos ni S3/ECR) ---

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
  name               = "${var.resource_prefix}-pgproxy-role"
  assume_role_policy = data.aws_iam_policy_document.assume.json

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-pgproxy-role"
  })
}

resource "aws_iam_role_policy_attachment" "ssm_core" {
  role       = aws_iam_role.instance.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "this" {
  name = "${var.resource_prefix}-pgproxy-profile"
  role = aws_iam_role.instance.name
}

# --- Instancia EC2 (HAProxy TCP passthrough) ---

resource "aws_instance" "this" {
  ami                    = var.ami
  instance_type          = var.instance_type
  subnet_id              = var.subnet_id
  vpc_security_group_ids = [aws_security_group.this.id]
  iam_instance_profile   = aws_iam_instance_profile.this.name

  associate_public_ip_address = false
  credit_specification {
    cpu_credits = "unlimited"
  }
  user_data = templatefile("${path.module}/user_data.sh.tpl", {
    rds_address = var.rds_address
    rds_port    = var.rds_port
  })
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
    Name = "${var.resource_prefix}-pgproxy"
  })

  lifecycle {
    ignore_changes = [associate_public_ip_address]
  }
}

# --- Elastic IP estable para pgAdmin ---

resource "aws_eip" "this" {
  domain = "vpc"

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-pgproxy-eip"
  })
}

resource "aws_eip_association" "this" {
  instance_id   = aws_instance.this.id
  allocation_id = aws_eip.this.id
}

# --- Monitoreo: alarma de status check de la instancia proxy ---

resource "aws_cloudwatch_metric_alarm" "status_check_failed" {
  alarm_name          = "${var.resource_prefix}-pgproxy-status"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 2
  threshold           = 1
  period              = 60
  statistic           = "Maximum"
  metric_name         = "StatusCheckFailed"
  namespace           = "AWS/EC2"

  dimensions = {
    InstanceId = aws_instance.this.id
  }

  alarm_actions = []

  tags = var.tags
}

# Único punto de entrada público: ALB.
resource "aws_security_group" "alb" {
  name        = "${var.resource_prefix}-alb-sg"
  description = "Ingreso HTTP/HTTPS publico al ALB"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-alb-sg"
  })
}

resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTP publico (redireccion a HTTPS)"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  security_group_id = aws_security_group.alb.id
  description       = "HTTPS publico"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "alb_to_ecs" {
  security_group_id            = aws_security_group.alb.id
  description                  = "ALB hacia las tareas ECS"
  referenced_security_group_id = aws_security_group.ecs.id
  from_port                    = var.app_port
  to_port                      = var.app_port
  ip_protocol                  = "tcp"
}

# Tareas ECS: sin exposicion publica directa; solo el ALB puede alcanzarlas.
resource "aws_security_group" "ecs" {
  name        = "${var.resource_prefix}-ecs-sg"
  description = "Tareas ECS: ingreso solo desde el ALB"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-ecs-sg"
  })
}

resource "aws_vpc_security_group_ingress_rule" "ecs_from_alb" {
  security_group_id            = aws_security_group.ecs.id
  description                  = "Aplicacion desde el ALB"
  referenced_security_group_id = aws_security_group.alb.id
  from_port                    = var.app_port
  to_port                      = var.app_port
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "ecs_to_rds" {
  security_group_id            = aws_security_group.ecs.id
  description                  = "ECS hacia PostgreSQL"
  referenced_security_group_id = aws_security_group.rds.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "ecs_https" {
  security_group_id = aws_security_group.ecs.id
  description       = "Salida HTTPS a servicios externos y AWS"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "ecs_http" {
  security_group_id = aws_security_group.ecs.id
  description       = "Salida HTTP (endpoints heredados)"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "ecs_smtp" {
  # for_each requiere un conjunto de strings; los puertos son numéricos.
  for_each = toset([for port in var.smtp_egress_ports : tostring(port)])

  security_group_id = aws_security_group.ecs.id
  description       = "Salida SMTP"
  cidr_ipv4         = "0.0.0.0/0"
  from_port         = tonumber(each.value)
  to_port           = tonumber(each.value)
  ip_protocol       = "tcp"
}

# RDS: solo accesible desde ECS; nunca publico.
resource "aws_security_group" "rds" {
  name        = "${var.resource_prefix}-rds-sg"
  description = "PostgreSQL accesible unicamente desde ECS"
  vpc_id      = var.vpc_id

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-rds-sg"
  })
}

resource "aws_vpc_security_group_ingress_rule" "rds_from_ecs" {
  security_group_id            = aws_security_group.rds.id
  description                  = "PostgreSQL desde ECS"
  referenced_security_group_id = aws_security_group.ecs.id
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
}

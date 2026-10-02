resource "aws_lb" "this" {
  name               = "${var.resource_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [var.alb_security_group_id]
  subnets            = var.public_subnet_ids

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-alb"
  })
}

resource "aws_lb_target_group" "app" {
  name        = "${var.resource_prefix}-tg"
  port        = var.app_port
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "instance"

  health_check {
    enabled             = true
    path                = var.health_check_path
    port                = "traffic-port"
    protocol            = "HTTP"
    matcher             = "200"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  deregistration_delay = 30

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-tg"
  })
}

# HTTP: redirige a HTTPS si está habilitado; de lo contrario, forward (QA inicial).
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = var.enable_https ? "redirect" : "fixed-response"

    dynamic "redirect" {
      for_each = var.enable_https ? [1] : []

      content {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }

    dynamic "fixed_response" {
      for_each = var.enable_https ? [] : [1]

      content {
        content_type = "text/plain"
        message_body = "Forbidden"
        status_code  = "403"
      }
    }
  }

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-http"
  })
}

resource "aws_lb_listener" "https" {
  count = var.enable_https ? 1 : 0

  load_balancer_arn = aws_lb.this.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn

  # Protección de origen (CloudFront → ALB): si hay header de protección,
  # la acción por defecto rechaza y solo la regla con el header correcto enruta.
  default_action {
    type             = var.origin_protect_header_name != null ? "fixed-response" : "forward"
    target_group_arn = var.origin_protect_header_name != null ? null : aws_lb_target_group.app.arn

    dynamic "fixed_response" {
      for_each = var.origin_protect_header_name != null ? [1] : []

      content {
        content_type = "text/plain"
        message_body = "Forbidden"
        status_code  = "403"
      }
    }
  }

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-https"
  })
}

# Solo enruta cuando CloudFront envía el header de protección correcto.
resource "aws_lb_listener_rule" "origin_protect" {
  count = var.enable_https && var.origin_protect_header_name != null ? 1 : 0

  listener_arn = aws_lb_listener.https[0].arn
  priority     = 1

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }

  condition {
    http_header {
      http_header_name = var.origin_protect_header_name
      values           = [var.origin_protect_header_value]
    }
  }
}

# Registro DNS opcional. Deshabilitado por defecto: QA usa el DNS nativo del ALB.
resource "aws_route53_record" "this" {
  count = var.create_dns_record ? 1 : 0

  zone_id = var.hosted_zone_id
  name    = var.domain_name
  type    = "A"

  alias {
    name                   = aws_lb.this.dns_name
    zone_id                = aws_lb.this.zone_id
    evaluate_target_health = true
  }
}

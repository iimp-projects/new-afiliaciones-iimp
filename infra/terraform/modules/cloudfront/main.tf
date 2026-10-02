# Aplicación dinámica y autenticada: sin caché agresivo. Se usan las políticas
# gestionadas "CachingDisabled" (caché) y "AllViewer" (reenvío de todo).
data "aws_cloudfront_cache_policy" "disabled" {
  name = "Managed-CachingDisabled"
}

data "aws_cloudfront_origin_request_policy" "all_viewer" {
  name = "Managed-AllViewer"
}

# X-Robots-Tag global: noindex, nofollow, noarchive.
resource "aws_cloudfront_response_headers_policy" "noindex" {
  name = "${var.resource_prefix}-noindex"

  custom_headers_config {
    items {
      header   = "X-Robots-Tag"
      override = true
      value    = "noindex, nofollow, noarchive"
    }
  }
}

resource "aws_cloudfront_distribution" "this" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.resource_prefix} production distribution"
  default_root_object = var.default_root_object
  price_class         = var.price_class

  aliases = var.domain_name != null ? [var.domain_name] : []

  origin {
    domain_name = var.alb_dns_name
    origin_id   = "alb"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = var.origin_protocol_policy
      origin_ssl_protocols   = ["TLSv1.2"]
    }

    # Header de protección del origen: el ALB solo enruta si coincide.
    custom_header {
      name  = var.origin_protect_header_name
      value = var.origin_protect_header_value
    }
  }

  default_cache_behavior {
    target_origin_id       = "alb"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    compress               = true

    cache_policy_id            = data.aws_cloudfront_cache_policy.disabled.id
    origin_request_policy_id   = data.aws_cloudfront_origin_request_policy.all_viewer.id
    response_headers_policy_id = aws_cloudfront_response_headers_policy.noindex.id
  }

  viewer_certificate {
    cloudfront_default_certificate = var.acm_certificate_arn == null ? true : false
    acm_certificate_arn            = var.acm_certificate_arn
    ssl_support_method             = var.acm_certificate_arn != null ? "sni-only" : null
    minimum_protocol_version       = var.acm_certificate_arn != null ? "TLSv1.2_2021" : null
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  web_acl_id = var.web_acl_id

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-cf"
  })
}

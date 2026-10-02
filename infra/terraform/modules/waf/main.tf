locals {
  metric_prefix = replace(var.resource_prefix, "-", "_")
}

# Web ACL de alcance CLOUDFRONT (debe crearse en us-east-1).
# Baseline de seguridad razonable, no exagerada: reglas gestionadas en COUNT
# (falsos positivos primero) + una regla rate-based en BLOCK.
resource "aws_wafv2_web_acl" "this" {
  name        = "${var.resource_prefix}-waf"
  description = "WAF de producción (scope CLOUDFRONT)"
  scope       = "CLOUDFRONT"

  default_action {
    allow {}
  }

  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1

    override_action {
      count {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesCommonRuleSet"
      sampled_requests_enabled   = true
    }
  }

  dynamic "rule" {
    for_each = var.enable_rate_limit ? [1] : []

    content {
      name     = "RateLimit"
      priority = 2

      action {
        block {}
      }

      statement {
        rate_based_statement {
          limit              = var.rate_limit
          aggregate_key_type = "IP"
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = "RateLimit"
        sampled_requests_enabled   = true
      }
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${local.metric_prefix}_waf"
    sampled_requests_enabled   = true
  }

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-waf"
  })
}

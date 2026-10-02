output "web_acl_arn" {
  description = "ARN del Web ACL WAF (para asociar a CloudFront)."
  value       = aws_wafv2_web_acl.this.arn
}

output "web_acl_id" {
  description = "ID del Web ACL WAF."
  value       = aws_wafv2_web_acl.this.id
}

output "distribution_id" {
  description = "ID de la distribución CloudFront."
  value       = aws_cloudfront_distribution.this.id
}

output "distribution_arn" {
  description = "ARN de la distribución CloudFront."
  value       = aws_cloudfront_distribution.this.arn
}

output "distribution_domain_name" {
  description = "Dominio de la distribución (d123.cloudfront.net)."
  value       = aws_cloudfront_distribution.this.domain_name
}

output "distribution_hosted_zone_id" {
  description = "Hosted zone ID de CloudFront (para alias DNS)."
  value       = aws_cloudfront_distribution.this.hosted_zone_id
}

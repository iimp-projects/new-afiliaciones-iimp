output "alb_arn" {
  description = "ARN del ALB."
  value       = aws_lb.this.arn
}

output "alb_dns_name" {
  description = "DNS nativo del ALB."
  value       = aws_lb.this.dns_name
}

output "alb_zone_id" {
  description = "Zone ID del ALB (para alias DNS)."
  value       = aws_lb.this.zone_id
}

output "target_group_arn" {
  description = "ARN del target group de la aplicación."
  value       = aws_lb_target_group.app.arn
}

output "http_listener_arn" {
  description = "ARN del listener HTTP."
  value       = aws_lb_listener.http.arn
}

output "https_listener_arn" {
  description = "ARN del listener HTTPS (si está habilitado)."
  value       = try(aws_lb_listener.https[0].arn, null)
}

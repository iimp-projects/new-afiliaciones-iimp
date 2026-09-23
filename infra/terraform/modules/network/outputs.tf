output "vpc_id" {
  description = "ID de la VPC."
  value       = aws_vpc.this.id
}

output "vpc_cidr" {
  description = "CIDR de la VPC."
  value       = aws_vpc.this.cidr_block
}

output "public_subnet_ids" {
  description = "IDs de las subredes públicas."
  value       = aws_subnet.public[*].id
}

output "private_app_subnet_ids" {
  description = "IDs de las subredes privadas de aplicación."
  value       = aws_subnet.private_app[*].id
}

output "private_db_subnet_ids" {
  description = "IDs de las subredes privadas de base de datos."
  value       = aws_subnet.private_db[*].id
}

output "nat_gateway_ids" {
  description = "IDs de los NAT Gateways creados."
  value       = aws_nat_gateway.this[*].id
}

output "availability_zones" {
  description = "Availability Zones utilizadas."
  value       = var.availability_zones
}

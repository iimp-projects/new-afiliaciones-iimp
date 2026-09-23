data "aws_region" "current" {}

locals {
  public_count = length(var.public_subnet_cidrs)
  app_count    = length(var.private_app_subnet_cidrs)
  db_count     = length(var.private_db_subnet_cidrs)
  nat_count    = var.enable_nat_gateway ? (var.single_nat_gateway ? 1 : local.public_count) : 0
}

resource "aws_vpc" "this" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-vpc"
  })
}

resource "aws_subnet" "public" {
  count = local.public_count

  vpc_id                  = aws_vpc.this.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-public-${count.index + 1}"
    Tier = "public"
  })
}

resource "aws_subnet" "private_app" {
  count = local.app_count

  vpc_id                  = aws_vpc.this.id
  cidr_block              = var.private_app_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = false

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-app-${count.index + 1}"
    Tier = "private-app"
  })
}

resource "aws_subnet" "private_db" {
  count = local.db_count

  vpc_id                  = aws_vpc.this.id
  cidr_block              = var.private_db_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = false

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-db-${count.index + 1}"
    Tier = "private-db"
  })
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-igw"
  })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-public-rt"
  })
}

resource "aws_route" "public_internet" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.this.id
}

resource "aws_route_table_association" "public" {
  count = local.public_count

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_eip" "nat" {
  count = local.nat_count

  domain = "vpc"

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-nat-eip-${count.index + 1}"
  })
}

resource "aws_nat_gateway" "this" {
  count = local.nat_count

  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[var.single_nat_gateway ? 0 : count.index].id

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-nat-${count.index + 1}"
  })

  depends_on = [aws_internet_gateway.this]
}

# Subredes de aplicación: salida a Internet vía NAT cuando está habilitado.
resource "aws_route_table" "private_app" {
  count = local.app_count

  vpc_id = aws_vpc.this.id

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-app-rt-${count.index + 1}"
  })
}

resource "aws_route" "private_app_nat" {
  count = var.enable_nat_gateway ? local.app_count : 0

  route_table_id         = aws_route_table.private_app[count.index].id
  destination_cidr_block = "0.0.0.0/0"
  nat_gateway_id         = aws_nat_gateway.this[var.single_nat_gateway ? 0 : count.index].id
}

resource "aws_route_table_association" "private_app" {
  count = local.app_count

  subnet_id      = aws_subnet.private_app[count.index].id
  route_table_id = aws_route_table.private_app[count.index].id
}

# Subredes de base de datos: sin ruta a Internet.
resource "aws_route_table" "private_db" {
  count = local.db_count

  vpc_id = aws_vpc.this.id

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-db-rt-${count.index + 1}"
  })
}

resource "aws_route_table_association" "private_db" {
  count = local.db_count

  subnet_id      = aws_subnet.private_db[count.index].id
  route_table_id = aws_route_table.private_db[count.index].id
}

# --- VPC endpoints (reducen el tráfico por NAT para servicios AWS) ---

resource "aws_security_group" "vpc_endpoints" {
  count = var.enable_interface_endpoints ? 1 : 0

  name        = "${var.resource_prefix}-vpce-sg"
  description = "Acceso HTTPS a VPC endpoints desde las subredes de aplicacion"
  vpc_id      = aws_vpc.this.id

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-vpce-sg"
  })
}

resource "aws_vpc_security_group_ingress_rule" "vpc_endpoints_https" {
  count = var.enable_interface_endpoints ? 1 : 0

  security_group_id = aws_security_group.vpc_endpoints[0].id
  description       = "HTTPS desde la VPC"
  cidr_ipv4         = var.vpc_cidr
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
}

resource "aws_vpc_security_group_egress_rule" "vpc_endpoints_all" {
  count = var.enable_interface_endpoints ? 1 : 0

  security_group_id = aws_security_group.vpc_endpoints[0].id
  description       = "Salida permitida del endpoint"
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}

resource "aws_vpc_endpoint" "s3" {
  count = var.enable_s3_gateway_endpoint ? 1 : 0

  vpc_id            = aws_vpc.this.id
  service_name      = "com.amazonaws.${data.aws_region.current.name}.s3"
  vpc_endpoint_type = "Gateway"
  # Solo subredes de aplicación: RDS no usa S3.
  route_table_ids = aws_route_table.private_app[*].id

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-vpce-s3"
  })
}

locals {
  interface_endpoints = var.enable_interface_endpoints ? toset([
    "ecr.api",
    "ecr.dkr",
    "logs",
    "secretsmanager",
    "sns",
  ]) : toset([])
}

resource "aws_vpc_endpoint" "interface" {
  for_each = local.interface_endpoints

  vpc_id              = aws_vpc.this.id
  service_name        = "com.amazonaws.${data.aws_region.current.name}.${each.value}"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private_app[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints[0].id]
  private_dns_enabled = true

  tags = merge(var.tags, {
    Name = "${var.resource_prefix}-vpce-${replace(each.value, ".", "-")}"
  })
}

# terraform/regions/ap-southeast.tf
# Infrastructure Vibe-Coding — Région Asie du Sud-Est (Singapour, ap-southeast-1)
# Activé uniquement si var.enable_ap_southeast = true

# ─────────────────────────────────────────────────────────────────────────────
# RDS PostgreSQL — Asie
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_db_subnet_group" "ap_southeast" {
  count    = var.enable_ap_southeast ? 1 : 0
  provider = aws.ap-southeast

  name       = "vibe-coding-ap-southeast-db"
  subnet_ids = module.vpc_ap_southeast[0].private_subnets
}

resource "aws_security_group" "rds_ap_southeast" {
  count    = var.enable_ap_southeast ? 1 : 0
  provider = aws.ap-southeast

  name        = "vibe-coding-rds-ap-southeast"
  description = "Security group RDS PostgreSQL Singapour"
  vpc_id      = module.vpc_ap_southeast[0].vpc_id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [module.vpc_ap_southeast[0].vpc_cidr_block]
  }
}

resource "aws_db_instance" "ap_southeast" {
  count    = var.enable_ap_southeast ? 1 : 0
  provider = aws.ap-southeast

  identifier     = "vibe-coding-ap-southeast"
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = var.postgres_instance_class

  allocated_storage     = 50
  max_allocated_storage = 200
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = "vibecoding"
  username = "vibecoding"
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.ap_southeast[0].name
  vpc_security_group_ids = [aws_security_group.rds_ap_southeast[0].id]

  multi_az                = false
  backup_retention_period = 7

  deletion_protection = var.environment == "production"
  skip_final_snapshot = var.environment != "production"

  tags = {
    Name   = "vibe-coding-ap-southeast"
    Region = "ap-southeast"
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# ElastiCache Redis — Asie
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_elasticache_subnet_group" "ap_southeast" {
  count    = var.enable_ap_southeast ? 1 : 0
  provider = aws.ap-southeast

  name       = "vibe-coding-ap-southeast-redis"
  subnet_ids = module.vpc_ap_southeast[0].private_subnets
}

resource "aws_elasticache_cluster" "ap_southeast" {
  count    = var.enable_ap_southeast ? 1 : 0
  provider = aws.ap-southeast

  cluster_id      = "vibe-coding-ap-se"
  engine          = "redis"
  node_type       = var.redis_node_type
  num_cache_nodes = 1
  port            = 6379

  subnet_group_name = aws_elasticache_subnet_group.ap_southeast[0].name
}

# ─────────────────────────────────────────────────────────────────────────────
# S3 — Stockage Asie
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_s3_bucket" "ap_southeast" {
  count    = var.enable_ap_southeast ? 1 : 0
  provider = aws.ap-southeast

  bucket = "vibe-coding-ap-southeast-${var.environment}"
}

# ─────────────────────────────────────────────────────────────────────────────
# Route 53 — Enregistrement Asie
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_route53_record" "vibe_coding_ap" {
  count    = var.enable_ap_southeast ? 1 : 0

  zone_id        = data.aws_route53_zone.main.zone_id
  name           = "vibe-coding.${var.domain_name}"
  type           = "CNAME"
  ttl            = 60
  set_identifier = "ap-southeast"

  latency_routing_policy {
    region = "ap-southeast-1"
  }

  records = [module.eks_ap_southeast[0].cluster_endpoint]
}

# ─────────────────────────────────────────────────────────────────────────────
# Outputs Asie
# ─────────────────────────────────────────────────────────────────────────────

output "db_endpoint_ap_southeast" {
  value       = var.enable_ap_southeast ? aws_db_instance.ap_southeast[0].endpoint : "N/A (région désactivée)"
  description = "Endpoint RDS Asie"
  sensitive   = true
}

output "redis_endpoint_ap_southeast" {
  value       = var.enable_ap_southeast ? aws_elasticache_cluster.ap_southeast[0].cache_nodes[0].address : "N/A"
  description = "Endpoint Redis Asie"
}

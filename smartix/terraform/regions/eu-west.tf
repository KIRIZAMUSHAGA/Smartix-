# terraform/regions/eu-west.tf
# Infrastructure Vibe-Coding — Région Europe de l'Ouest (Paris, eu-west-3)

# ─────────────────────────────────────────────────────────────────────────────
# RDS PostgreSQL — Europe
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_db_subnet_group" "eu_west" {
  provider   = aws.eu-west
  name       = "vibe-coding-eu-west-db"
  subnet_ids = module.vpc_eu_west.private_subnets

  tags = {
    Name = "vibe-coding-eu-west-db-subnet-group"
  }
}

resource "aws_security_group" "rds_eu_west" {
  provider    = aws.eu-west
  name        = "vibe-coding-rds-eu-west"
  description = "Security group RDS PostgreSQL Europe"
  vpc_id      = module.vpc_eu_west.vpc_id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [module.vpc_eu_west.vpc_cidr_block]
  }
}

resource "aws_db_instance" "eu_west" {
  provider = aws.eu-west

  identifier     = "vibe-coding-eu-west"
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = var.postgres_instance_class

  allocated_storage     = 100
  max_allocated_storage = 500
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = "vibecoding"
  username = "vibecoding"
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.eu_west.name
  vpc_security_group_ids = [aws_security_group.rds_eu_west.id]

  multi_az               = true
  backup_retention_period = 7
  backup_window           = "02:00-03:00"
  maintenance_window      = "sun:04:00-sun:05:00"

  deletion_protection = var.environment == "production"
  skip_final_snapshot = var.environment != "production"

  performance_insights_enabled = true

  tags = {
    Name   = "vibe-coding-eu-west"
    Region = "eu-west"
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# ElastiCache Redis — Europe
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_elasticache_subnet_group" "eu_west" {
  provider   = aws.eu-west
  name       = "vibe-coding-eu-west-redis"
  subnet_ids = module.vpc_eu_west.private_subnets
}

resource "aws_elasticache_replication_group" "eu_west" {
  provider = aws.eu-west

  replication_group_id       = "vibe-coding-eu-west"
  description                = "Redis cluster Vibe-Coding Europe"
  node_type                  = var.redis_node_type
  num_cache_clusters         = 2
  port                       = 6379
  subnet_group_name          = aws_elasticache_subnet_group.eu_west.name
  automatic_failover_enabled = true
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
}

# ─────────────────────────────────────────────────────────────────────────────
# S3 — Stockage fichiers Europe
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_s3_bucket" "eu_west" {
  provider = aws.eu-west
  bucket   = "vibe-coding-eu-west-${var.environment}"
}

resource "aws_s3_bucket_versioning" "eu_west" {
  provider = aws.eu-west
  bucket   = aws_s3_bucket.eu_west.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "eu_west" {
  provider = aws.eu-west
  bucket   = aws_s3_bucket.eu_west.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# Outputs Europe
# ─────────────────────────────────────────────────────────────────────────────

output "db_endpoint_eu_west" {
  value       = aws_db_instance.eu_west.endpoint
  description = "Endpoint RDS Europe"
  sensitive   = true
}

output "redis_endpoint_eu_west" {
  value       = aws_elasticache_replication_group.eu_west.primary_endpoint_address
  description = "Endpoint Redis Europe"
}

output "s3_bucket_eu_west" {
  value       = aws_s3_bucket.eu_west.bucket
  description = "Bucket S3 Europe"
}

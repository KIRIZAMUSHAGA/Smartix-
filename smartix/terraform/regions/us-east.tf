# terraform/regions/us-east.tf
# Infrastructure Vibe-Coding — Région USA Est (Virginie du Nord, us-east-1)

# ─────────────────────────────────────────────────────────────────────────────
# RDS PostgreSQL — USA
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_db_subnet_group" "us_east" {
  provider   = aws.us-east
  name       = "vibe-coding-us-east-db"
  subnet_ids = module.vpc_us_east.private_subnets
}

resource "aws_security_group" "rds_us_east" {
  provider    = aws.us-east
  name        = "vibe-coding-rds-us-east"
  description = "Security group RDS PostgreSQL USA"
  vpc_id      = module.vpc_us_east.vpc_id

  ingress {
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = [module.vpc_us_east.vpc_cidr_block]
  }
}

resource "aws_db_instance" "us_east" {
  provider = aws.us-east

  identifier     = "vibe-coding-us-east"
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

  db_subnet_group_name   = aws_db_subnet_group.us_east.name
  vpc_security_group_ids = [aws_security_group.rds_us_east.id]

  multi_az                = true
  backup_retention_period = 7
  backup_window           = "06:00-07:00"
  maintenance_window      = "sun:08:00-sun:09:00"

  deletion_protection = var.environment == "production"
  skip_final_snapshot = var.environment != "production"

  performance_insights_enabled = true

  tags = {
    Name   = "vibe-coding-us-east"
    Region = "us-east"
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# ElastiCache Redis — USA
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_elasticache_subnet_group" "us_east" {
  provider   = aws.us-east
  name       = "vibe-coding-us-east-redis"
  subnet_ids = module.vpc_us_east.private_subnets
}

resource "aws_elasticache_replication_group" "us_east" {
  provider = aws.us-east

  replication_group_id       = "vibe-coding-us-east"
  description                = "Redis cluster Vibe-Coding USA"
  node_type                  = var.redis_node_type
  num_cache_clusters         = 2
  port                       = 6379
  subnet_group_name          = aws_elasticache_subnet_group.us_east.name
  automatic_failover_enabled = true
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
}

# ─────────────────────────────────────────────────────────────────────────────
# S3 — Stockage fichiers USA
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_s3_bucket" "us_east" {
  provider = aws.us-east
  bucket   = "vibe-coding-us-east-${var.environment}"
}

resource "aws_s3_bucket_versioning" "us_east" {
  provider = aws.us-east
  bucket   = aws_s3_bucket.us_east.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "us_east" {
  provider = aws.us-east
  bucket   = aws_s3_bucket.us_east.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# CloudFront — CDN Global (depuis la région us-east-1)
# ─────────────────────────────────────────────────────────────────────────────

resource "aws_cloudfront_distribution" "global" {
  provider = aws.us-east

  origin {
    domain_name = "api.vibe-coding.smartix.com"
    origin_id   = "api-origin"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  enabled             = true
  is_ipv6_enabled     = true
  comment             = "CDN Vibe-Coding Global"
  default_root_object = "index.html"

  price_class = "PriceClass_All"

  default_cache_behavior {
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "api-origin"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    min_ttl     = 0
    default_ttl = 86400
    max_ttl     = 31536000

    forwarded_values {
      query_string = true
      headers      = ["Authorization", "Origin"]
      cookies {
        forward = "none"
      }
    }
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = false
    acm_certificate_arn            = aws_acm_certificate.global.arn
    ssl_support_method             = "sni-only"
    minimum_protocol_version       = "TLSv1.2_2021"
  }
}

resource "aws_acm_certificate" "global" {
  provider          = aws.us-east
  domain_name       = "*.vibe-coding.smartix.com"
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# Outputs USA
# ─────────────────────────────────────────────────────────────────────────────

output "db_endpoint_us_east" {
  value       = aws_db_instance.us_east.endpoint
  description = "Endpoint RDS USA"
  sensitive   = true
}

output "redis_endpoint_us_east" {
  value       = aws_elasticache_replication_group.us_east.primary_endpoint_address
  description = "Endpoint Redis USA"
}

output "cloudfront_domain" {
  value       = aws_cloudfront_distribution.global.domain_name
  description = "Domaine CloudFront CDN global"
}

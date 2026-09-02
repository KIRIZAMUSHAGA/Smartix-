terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"
    }
  }

  backend "s3" {
    bucket         = "vibe-coding-terraform-state"
    key            = "global/terraform.tfstate"
    region         = "eu-west-3"
    encrypt        = true
    dynamodb_table = "vibe-coding-terraform-locks"
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# Providers multi-régions
# ─────────────────────────────────────────────────────────────────────────────

provider "aws" {
  alias  = "eu-west"
  region = "eu-west-3"

  default_tags {
    tags = {
      Project     = "vibe-coding"
      Environment = var.environment
      ManagedBy   = "terraform"
      Region      = "eu-west"
    }
  }
}

provider "aws" {
  alias  = "us-east"
  region = "us-east-1"

  default_tags {
    tags = {
      Project     = "vibe-coding"
      Environment = var.environment
      ManagedBy   = "terraform"
      Region      = "us-east"
    }
  }
}

provider "aws" {
  alias  = "ap-southeast"
  region = "ap-southeast-1"

  default_tags {
    tags = {
      Project     = "vibe-coding"
      Environment = var.environment
      ManagedBy   = "terraform"
      Region      = "ap-southeast"
    }
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# Modules EKS par région
# ─────────────────────────────────────────────────────────────────────────────

module "eks_eu_west" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 19.0"

  providers = {
    aws = aws.eu-west
  }

  cluster_name    = "vibe-coding-eu-west"
  cluster_version = "1.28"

  vpc_id     = module.vpc_eu_west.vpc_id
  subnet_ids = module.vpc_eu_west.private_subnets

  cluster_endpoint_public_access = true
  cluster_endpoint_private_access = true

  eks_managed_node_groups = {
    main = {
      desired_size   = 2
      max_size       = 10
      min_size       = 1
      instance_types = ["t3.large"]

      labels = {
        region = "eu-west"
      }
    }
    sandbox = {
      desired_size   = 1
      max_size       = 5
      min_size       = 1
      instance_types = ["t3.xlarge"]

      labels = {
        role = "sandbox"
      }

      taints = [{
        key    = "sandbox"
        value  = "true"
        effect = "NO_SCHEDULE"
      }]
    }
  }
}

module "eks_us_east" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 19.0"

  providers = {
    aws = aws.us-east
  }

  cluster_name    = "vibe-coding-us-east"
  cluster_version = "1.28"

  vpc_id     = module.vpc_us_east.vpc_id
  subnet_ids = module.vpc_us_east.private_subnets

  cluster_endpoint_public_access  = true
  cluster_endpoint_private_access = true

  eks_managed_node_groups = {
    main = {
      desired_size   = 2
      max_size       = 10
      min_size       = 1
      instance_types = ["t3.large"]

      labels = {
        region = "us-east"
      }
    }
  }
}

module "eks_ap_southeast" {
  count = var.enable_ap_southeast ? 1 : 0

  source  = "terraform-aws-modules/eks/aws"
  version = "~> 19.0"

  providers = {
    aws = aws.ap-southeast
  }

  cluster_name    = "vibe-coding-ap-southeast"
  cluster_version = "1.28"

  vpc_id     = module.vpc_ap_southeast[0].vpc_id
  subnet_ids = module.vpc_ap_southeast[0].private_subnets

  eks_managed_node_groups = {
    main = {
      desired_size   = 1
      max_size       = 5
      min_size       = 1
      instance_types = ["t3.large"]
    }
  }
}

# ─────────────────────────────────────────────────────────────────────────────
# VPCs par région
# ─────────────────────────────────────────────────────────────────────────────

module "vpc_eu_west" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  providers = { aws = aws.eu-west }

  name = "vibe-coding-eu-west"
  cidr = "10.0.0.0/16"

  azs             = ["eu-west-3a", "eu-west-3b", "eu-west-3c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway   = true
  single_nat_gateway   = false
  enable_dns_hostnames = true
  enable_dns_support   = true
}

module "vpc_us_east" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  providers = { aws = aws.us-east }

  name = "vibe-coding-us-east"
  cidr = "10.1.0.0/16"

  azs             = ["us-east-1a", "us-east-1b", "us-east-1c"]
  private_subnets = ["10.1.1.0/24", "10.1.2.0/24", "10.1.3.0/24"]
  public_subnets  = ["10.1.101.0/24", "10.1.102.0/24", "10.1.103.0/24"]

  enable_nat_gateway   = true
  enable_dns_hostnames = true
  enable_dns_support   = true
}

module "vpc_ap_southeast" {
  count = var.enable_ap_southeast ? 1 : 0

  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  providers = { aws = aws.ap-southeast }

  name = "vibe-coding-ap-southeast"
  cidr = "10.2.0.0/16"

  azs             = ["ap-southeast-1a", "ap-southeast-1b"]
  private_subnets = ["10.2.1.0/24", "10.2.2.0/24"]
  public_subnets  = ["10.2.101.0/24", "10.2.102.0/24"]

  enable_nat_gateway   = true
  enable_dns_hostnames = true
  enable_dns_support   = true
}

# ─────────────────────────────────────────────────────────────────────────────
# Route 53 — DNS global avec latency-based routing
# ─────────────────────────────────────────────────────────────────────────────

data "aws_route53_zone" "main" {
  name = var.domain_name
}

resource "aws_route53_record" "vibe_coding_eu" {
  zone_id        = data.aws_route53_zone.main.zone_id
  name           = "vibe-coding.${var.domain_name}"
  type           = "CNAME"
  ttl            = 60
  set_identifier = "eu-west"

  latency_routing_policy {
    region = "eu-west-3"
  }

  records = [module.eks_eu_west.cluster_endpoint]
}

resource "aws_route53_record" "vibe_coding_us" {
  zone_id        = data.aws_route53_zone.main.zone_id
  name           = "vibe-coding.${var.domain_name}"
  type           = "CNAME"
  ttl            = 60
  set_identifier = "us-east"

  latency_routing_policy {
    region = "us-east-1"
  }

  records = [module.eks_us_east.cluster_endpoint]
}

# ─────────────────────────────────────────────────────────────────────────────
# Outputs
# ─────────────────────────────────────────────────────────────────────────────

output "eks_eu_west_endpoint" {
  value       = module.eks_eu_west.cluster_endpoint
  description = "Endpoint du cluster EKS Europe"
}

output "eks_us_east_endpoint" {
  value       = module.eks_us_east.cluster_endpoint
  description = "Endpoint du cluster EKS USA"
}

output "global_dns" {
  value       = "vibe-coding.${var.domain_name}"
  description = "DNS global avec latency routing"
}

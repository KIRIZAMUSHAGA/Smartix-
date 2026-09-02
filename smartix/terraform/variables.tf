variable "environment" {
  type        = string
  description = "Environnement de déploiement (production, staging, dev)"
  default     = "production"

  validation {
    condition     = contains(["production", "staging", "dev"], var.environment)
    error_message = "L'environnement doit être production, staging ou dev."
  }
}

variable "domain_name" {
  type        = string
  description = "Domaine principal de l'application"
  default     = "smartix.com"
}

variable "enable_ap_southeast" {
  type        = bool
  description = "Activer la région Asie du Sud-Est (Singapour)"
  default     = false
}

variable "eks_cluster_version" {
  type        = string
  description = "Version de Kubernetes à utiliser pour les clusters EKS"
  default     = "1.28"
}

variable "node_instance_type_main" {
  type        = string
  description = "Type d'instance EC2 pour les nœuds principaux"
  default     = "t3.large"
}

variable "node_instance_type_sandbox" {
  type        = string
  description = "Type d'instance EC2 pour les nœuds sandbox"
  default     = "t3.xlarge"
}

variable "min_nodes" {
  type        = number
  description = "Nombre minimum de nœuds par région"
  default     = 1
}

variable "max_nodes" {
  type        = number
  description = "Nombre maximum de nœuds par région"
  default     = 10
}

variable "desired_nodes" {
  type        = number
  description = "Nombre de nœuds désiré au départ"
  default     = 2
}

variable "postgres_instance_class" {
  type        = string
  description = "Type d'instance RDS PostgreSQL"
  default     = "db.t3.medium"
}

variable "redis_node_type" {
  type        = string
  description = "Type de nœud ElastiCache Redis"
  default     = "cache.t3.micro"
}

variable "route53_zone_id" {
  type        = string
  description = "ID de la zone Route 53 pour le domaine principal"
  default     = ""
}

variable "clickhouse_password" {
  type        = string
  description = "Mot de passe ClickHouse (sensible)"
  sensitive   = true
  default     = ""
}

variable "db_password" {
  type        = string
  description = "Mot de passe PostgreSQL (sensible)"
  sensitive   = true
  default     = ""
}

variable "enable_monitoring" {
  type        = bool
  description = "Activer le monitoring ClickHouse + Grafana"
  default     = true
}

variable "grafana_admin_password" {
  type        = string
  description = "Mot de passe administrateur Grafana"
  sensitive   = true
  default     = "changeme"
}

variable "alert_email" {
  type        = string
  description = "Email pour les alertes de monitoring"
  default     = "ops@smartix.com"
}

variable "s3_state_bucket" {
  type        = string
  description = "Bucket S3 pour le state Terraform"
  default     = "vibe-coding-terraform-state"
}

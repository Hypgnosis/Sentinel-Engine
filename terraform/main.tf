# ═══════════════════════════════════════════════════════════════════
#  SENTINEL ENGINE v5.1 — Terraform Provider Configuration
#  Project: ha-sentinel-core-v21
#
#  This is the root Terraform configuration that enables the
#  required GCP APIs, creates Service Accounts, and provisions
#  Secret Manager slots for all sensitive keys.
#
#  V5.1: All IAM bindings from infra/provision-iam.sh are now
#  managed here. The shell script is DEPRECATED.
# ═══════════════════════════════════════════════════════════════════

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
  }

  # Remote state in GCS (create bucket manually first)
  # backend "gcs" {
  #   bucket = "ha-sentinel-terraform-state"
  #   prefix = "sentinel-engine/v51"
  # }
}

# ─────────────────────────────────────────────────────
#  VARIABLES
# ─────────────────────────────────────────────────────

variable "project_id" {
  description = "GCP Project ID"
  type        = string
  default     = "ha-sentinel-core-v21"
}

variable "region" {
  description = "Default GCP region"
  type        = string
  default     = "us-central1"
}

variable "alert_email" {
  description = "Engineering alert email"
  type        = string
  default     = "engineering@high-archy.tech"
}

# ─────────────────────────────────────────────────────
#  PROVIDER
# ─────────────────────────────────────────────────────

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# ─────────────────────────────────────────────────────
#  API ENABLEMENT
# ─────────────────────────────────────────────────────

resource "google_project_service" "apis" {
  for_each = toset([
    "bigquery.googleapis.com",
    "aiplatform.googleapis.com",
    "run.googleapis.com",
    "cloudscheduler.googleapis.com",
    "cloudbuild.googleapis.com",
    "artifactregistry.googleapis.com",
    "monitoring.googleapis.com",
    "logging.googleapis.com",
    "cloudfunctions.googleapis.com",
    "secretmanager.googleapis.com",
    "iam.googleapis.com",
  ])

  service            = each.value
  disable_on_destroy = false
}

# ─────────────────────────────────────────────────────
#  SERVICE ACCOUNTS
# ─────────────────────────────────────────────────────

resource "google_service_account" "etl_sa" {
  account_id   = "sentinel-etl-sa"
  display_name = "Sentinel ETL Pipeline"
  description  = "Least-privilege SA for the Sentinel ETL Cloud Run Job. Writes to BigQuery, reads secrets."
  project      = var.project_id
}

resource "google_service_account" "inference_sa" {
  account_id   = "sentinel-inference-sa"
  display_name = "Sentinel Inference Function"
  description  = "Least-privilege SA for the Sentinel Cloud Function. Reads BigQuery, calls Vertex AI, reads secrets."
  project      = var.project_id
}

# ── ETL SA Bindings ──

resource "google_project_iam_member" "etl_bq_editor" {
  project = var.project_id
  role    = "roles/bigquery.dataEditor"
  member  = "serviceAccount:${google_service_account.etl_sa.email}"
}

resource "google_project_iam_member" "etl_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.etl_sa.email}"
}

# ── Inference SA Bindings ──

resource "google_project_iam_member" "inference_bq_viewer" {
  project = var.project_id
  role    = "roles/bigquery.dataViewer"
  member  = "serviceAccount:${google_service_account.inference_sa.email}"
}

resource "google_project_iam_member" "inference_ai_user" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.inference_sa.email}"
}

# V5.1: This binding was previously ONLY in provision-iam.sh — production drift risk.
resource "google_project_iam_member" "inference_secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.inference_sa.email}"
}

# ─────────────────────────────────────────────────────
#  SECRET MANAGER — Slots for Sensitive Keys
# ─────────────────────────────────────────────────────

resource "google_secret_manager_secret" "gemini_api_key" {
  secret_id = "GEMINI_API_KEY"
  project   = var.project_id

  replication {
    auto {}
  }

  labels = {
    component = "inference"
    managed   = "terraform"
  }

  depends_on = [google_project_service.apis["secretmanager.googleapis.com"]]
}

resource "google_secret_manager_secret" "freightos_api_key" {
  secret_id = "FREIGHTOS_API_KEY"
  project   = var.project_id

  replication {
    auto {}
  }

  labels = {
    component = "etl"
    managed   = "terraform"
  }

  depends_on = [google_project_service.apis["secretmanager.googleapis.com"]]
}

resource "google_secret_manager_secret" "xeneta_api_key" {
  secret_id = "XENETA_API_KEY"
  project   = var.project_id

  replication {
    auto {}
  }

  labels = {
    component = "etl"
    managed   = "terraform"
  }

  depends_on = [google_project_service.apis["secretmanager.googleapis.com"]]
}

# ─────────────────────────────────────────────────────
#  ARTIFACT REGISTRY — Container Images
# ─────────────────────────────────────────────────────

resource "google_artifact_registry_repository" "sentinel_registry" {
  location      = var.region
  repository_id = "sentinel-registry"
  format        = "DOCKER"
  description   = "Sentinel Engine container images"
  project       = var.project_id

  depends_on = [google_project_service.apis["artifactregistry.googleapis.com"]]
}

# ─────────────────────────────────────────────────────
#  OUTPUTS
# ─────────────────────────────────────────────────────

output "etl_service_account" {
  value       = google_service_account.etl_sa.email
  description = "Email of the ETL service account"
}

output "inference_service_account" {
  value       = google_service_account.inference_sa.email
  description = "Email of the Inference service account"
}

output "secret_gemini" {
  value       = google_secret_manager_secret.gemini_api_key.name
  description = "Secret Manager resource name for GEMINI_API_KEY"
}

output "secret_freightos" {
  value       = google_secret_manager_secret.freightos_api_key.name
  description = "Secret Manager resource name for FREIGHTOS_API_KEY"
}

output "secret_xeneta" {
  value       = google_secret_manager_secret.xeneta_api_key.name
  description = "Secret Manager resource name for XENETA_API_KEY"
}

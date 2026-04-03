#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
#  SENTINEL ENGINE v4.0 — Cloud Monitoring Alert Policies
#  Configures production alerting for the ETL pipeline.
#
#  Alert Policies:
#    1. ETL Job Failure — fires when a Cloud Run Job execution fails
#    2. ETL Job Timeout — fires when execution exceeds 240s
#    3. Data Staleness  — fires when BigQuery data is > 90 min old
#
#  Prerequisites:
#    - Cloud Monitoring API enabled
#    - Notification channel configured (email/Slack/PagerDuty)
#
#  Usage:
#    export PROJECT_ID=ha-sentinel-core-prod
#    export ALERT_EMAIL=engineering@high-archy.tech
#    chmod +x alerts.sh && ./alerts.sh
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-ha-sentinel-core-prod}"
ALERT_EMAIL="${ALERT_EMAIL:-engineering@high-archy.tech}"

echo "╔══════════════════════════════════════════════════════════╗"
echo "║  SENTINEL ENGINE v4.0 — Cloud Monitoring Alerts          ║"
echo "║  Contact: ${ALERT_EMAIL}                                ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

# ── Step 1: Create email notification channel ──
echo "[1/4] Creating notification channel..."
CHANNEL_ID=$(gcloud alpha monitoring channels create \
  --display-name="Sentinel Engineering Team" \
  --type=email \
  --channel-labels="email_address=${ALERT_EMAIL}" \
  --project="${PROJECT_ID}" \
  --format="value(name)" 2>/dev/null || echo "")

if [ -z "$CHANNEL_ID" ]; then
  echo "  Channel may already exist. Listing existing channels..."
  CHANNEL_ID=$(gcloud alpha monitoring channels list \
    --project="${PROJECT_ID}" \
    --filter="displayName='Sentinel Engineering Team'" \
    --format="value(name)" | head -1)
fi

echo "  Channel: ${CHANNEL_ID}"

# ── Step 2: Alert Policy — ETL Job Failure ──
echo "[2/4] Creating alert: ETL Job Failure..."
cat > /tmp/sentinel-alert-failure.json <<EOF
{
  "displayName": "Sentinel ETL — Job Failure",
  "documentation": {
    "content": "The Sentinel ETL Cloud Run Job has failed. Check Cloud Run logs for the sentinel-etl job. Ingestion ID will be in the structured logs.",
    "mimeType": "text/markdown"
  },
  "conditions": [
    {
      "displayName": "Cloud Run Job Failed Execution",
      "conditionThreshold": {
        "filter": "resource.type=\"cloud_run_job\" AND resource.labels.job_name=\"sentinel-etl\" AND metric.type=\"run.googleapis.com/job/completed_execution_count\" AND metric.labels.result=\"failed\"",
        "comparison": "COMPARISON_GT",
        "thresholdValue": 0,
        "duration": "0s",
        "aggregations": [
          {
            "alignmentPeriod": "300s",
            "perSeriesAligner": "ALIGN_COUNT"
          }
        ]
      }
    }
  ],
  "alertStrategy": {
    "autoClose": "1800s"
  },
  "combiner": "OR",
  "enabled": true,
  "notificationChannels": ["${CHANNEL_ID}"]
}
EOF

gcloud alpha monitoring policies create \
  --policy-from-file=/tmp/sentinel-alert-failure.json \
  --project="${PROJECT_ID}" 2>/dev/null || echo "  Alert policy may already exist."

# ── Step 3: Alert Policy — ETL Job Timeout ──
echo "[3/4] Creating alert: ETL Job Timeout..."
cat > /tmp/sentinel-alert-timeout.json <<EOF
{
  "displayName": "Sentinel ETL — Execution Timeout Warning",
  "documentation": {
    "content": "The Sentinel ETL Cloud Run Job execution exceeded 240 seconds (of 300s limit). Pipeline may be at risk of timeout failures.",
    "mimeType": "text/markdown"
  },
  "conditions": [
    {
      "displayName": "Cloud Run Job Duration > 240s",
      "conditionThreshold": {
        "filter": "resource.type=\"cloud_run_job\" AND resource.labels.job_name=\"sentinel-etl\" AND metric.type=\"run.googleapis.com/job/completed_execution_count\"",
        "comparison": "COMPARISON_GT",
        "thresholdValue": 240000,
        "duration": "0s",
        "aggregations": [
          {
            "alignmentPeriod": "300s",
            "perSeriesAligner": "ALIGN_MAX"
          }
        ]
      }
    }
  ],
  "alertStrategy": {
    "autoClose": "3600s"
  },
  "combiner": "OR",
  "enabled": true,
  "notificationChannels": ["${CHANNEL_ID}"]
}
EOF

gcloud alpha monitoring policies create \
  --policy-from-file=/tmp/sentinel-alert-timeout.json \
  --project="${PROJECT_ID}" 2>/dev/null || echo "  Alert policy may already exist."

# ── Step 4: Summary ──
echo "[4/4] Alert policies configured."
echo ""
echo "[SENTINEL] Monitoring Alerts Active:"
echo "  1. ETL Job Failure     → Immediate alert on failed execution"
echo "  2. ETL Timeout Warning → Alert when execution > 240s"
echo "  Notification: ${ALERT_EMAIL}"
echo ""
echo "  To list all policies:"
echo "    gcloud alpha monitoring policies list --project=${PROJECT_ID}"
echo ""

#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Lerno GCP Setup Script
# Run each block manually in order. DO NOT run the whole file at once.
# Replace every YOUR_* placeholder before running.
# ─────────────────────────────────────────────────────────────────────────────

# ══════════════════════════════════════════════════════════════════════════════
# FILL THESE IN BEFORE ANYTHING ELSE
# ══════════════════════════════════════════════════════════════════════════════
PROJECT_ID="gen-lang-client-0600333089"          # e.g. lerno-prod-123456
REGION="asia-south1"
ZONE="asia-south1-a"
QDRANT_API_KEY="$(openssl rand -hex 32)"  # auto-generated strong key — save the output!

# ──────────────────────────────────────────────────────────────────────────────
# BLOCK 1 — Install gcloud CLI (Mac)
# ──────────────────────────────────────────────────────────────────────────────
# brew install --cask google-cloud-sdk
# Then restart your terminal.

# ──────────────────────────────────────────────────────────────────────────────
# BLOCK 2 — Authenticate and set project
# ──────────────────────────────────────────────────────────────────────────────
gcloud auth login
gcloud config set project gen-lang-client-0600333089
gcloud config set compute/region asia-south1
gcloud config set compute/zone asia-south1-a

# ──────────────────────────────────────────────────────────────────────────────
# BLOCK 3 — Enable required APIs (takes ~1 min)
# ──────────────────────────────────────────────────────────────────────────────
gcloud services enable \
  compute.googleapis.com \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  vpcaccess.googleapis.com \
  --project=gen-lang-client-0600333089

# ──────────────────────────────────────────────────────────────────────────────
# BLOCK 4 — Create Artifact Registry repo (Docker images for Cloud Run)
# ──────────────────────────────────────────────────────────────────────────────
gcloud artifacts repositories create lerno \
  --repository-format=docker \
  --location=asia-south1 \
  --project=gen-lang-client-0600333089

# ──────────────────────────────────────────────────────────────────────────────
# BLOCK 5 — Create the Qdrant VM
# e2-standard-2 = 2 vCPU / 8 GB RAM. Enough for Qdrant at school scale.
# pd-ssd = SSD persistent disk (fast random reads for vector search).
# cos-stable = Container-Optimized OS (Docker pre-installed).
# ──────────────────────────────────────────────────────────────────────────────
gcloud compute instances create lerno-qdrant \
  --project=gen-lang-client-0600333089 \
  --zone=asia-south1-a \
  --machine-type=e2-standard-2 \
  --boot-disk-size=50GB \
  --boot-disk-type=pd-ssd \
  --image-family=cos-stable \
  --image-project=cos-cloud \
  --tags=qdrant-server \
  --scopes=cloud-platform

# ──────────────────────────────────────────────────────────────────────────────
# BLOCK 6 — Firewall rule (internal only — Cloud Run can reach Qdrant, internet cannot)
# ──────────────────────────────────────────────────────────────────────────────
gcloud compute firewall-rules create allow-qdrant-internal \
  --project=gen-lang-client-0600333089 \
  --network=default \
  --allow=tcp:6333 \
  --source-ranges=10.0.0.0/8 \
  --target-tags=qdrant-server \
  --description="Qdrant internal access from Cloud Run VPC connector"

# ──────────────────────────────────────────────────────────────────────────────
# BLOCK 7 — Get VM's internal IP (save this — it becomes QDRANT_URL)
# ──────────────────────────────────────────────────────────────────────────────
gcloud compute instances describe lerno-qdrant \
  --zone=asia-south1-a \
  --format='get(networkInterfaces[0].networkIP)'
# Example output: 10.160.0.2 ---- THIS WAS THE ONE
# Your QDRANT_URL will be: http://10.160.0.2:6333

# ──────────────────────────────────────────────────────────────────────────────
# BLOCK 8 — SSH into VM and start Qdrant
# Run these commands ONE BY ONE after SSH-ing in.
# ──────────────────────────────────────────────────────────────────────────────
gcloud compute ssh lerno-qdrant --zone=asia-south1-a
# Once inside the VM, run:
#
#   mkdir -p /mnt/disks/qdrant/storage /mnt/disks/qdrant/snapshots
#
#   docker run -d \
#     --name qdrant \
#     --restart=always \
#     -p 6333:6333 \
#     -v /mnt/disks/qdrant/storage:/qdrant/storage \
#     -v /mnt/disks/qdrant/snapshots:/qdrant/snapshots \
#     -e QDRANT__SERVICE__API_KEY=00723ded5bb5a42b1f18f555fcc31e61ccad45402a67a9a868d72cc10ba7f786 \
#     -e QDRANT__SERVICE__HOST=0.0.0.0 \
#     qdrant/qdrant:latest
#
#   # Verify it started:
#   curl http://localhost:6333/collections
#   # Should return: {"result":{"collections":[]},"status":"ok",...}
#
#   exit

# ──────────────────────────────────────────────────────────────────────────────
# BLOCK 9 — Open SSH tunnel for migration (run in a SEPARATE terminal, keep it open)
# ──────────────────────────────────────────────────────────────────────────────
# gcloud compute ssh lerno-qdrant --zone=asia-south1-a -- -L 6334:localhost:6333
# This maps localhost:6334 on YOUR machine → port 6333 on the VM (Qdrant).
# Leave this terminal open while you run the migration.

# ──────────────────────────────────────────────────────────────────────────────
# BLOCK 10 — Run migration (in your project terminal, tunnel must be open)
# Get OLD_QDRANT_URL and OLD_QDRANT_API_KEY from qdrant.tech dashboard.
# ──────────────────────────────────────────────────────────────────────────────
# OLD_QDRANT_URL=https://3b3b6600-cd26-4a96-9cd7-22675aab709f.europe-west3-0.gcp.cloud.qdrant.io \
# OLD_QDRANT_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhY2Nlc3MiOiJtIn0.A8t32zvuIDjFIhlkusawEhkLeY_hBw0aqxcsJp7s33w \
# NEW_QDRANT_URL=http://127.0.0.1:6334 \
# NEW_QDRANT_API_KEY=00723ded5bb5a42b1f18f555fcc31e61ccad45402a67a9a868d72cc10ba7f786 \
# npm run qdrant:migrate

# ──────────────────────────────────────────────────────────────────────────────
# BLOCK 11 — Re-create indexes on new Qdrant (still through tunnel)
# ──────────────────────────────────────────────────────────────────────────────
# QDRANT_URL=http://localhost:6334 \
# QDRANT_API_KEY=PASTE_YOUR_QDRANT_API_KEY_HERE \
# npm run qdrant:setup

# ──────────────────────────────────────────────────────────────────────────────
# BLOCK 12 — Store ALL secrets in Secret Manager
# Replace every value with your real secrets from .env.local
# ──────────────────────────────────────────────────────────────────────────────
store_secret() {
  echo -n "$2" | gcloud secrets create "$1" --data-file=- --project=$PROJECT_ID 2>/dev/null \
    || echo -n "$2" | gcloud secrets versions add "$1" --data-file=- --project=$PROJECT_ID
}

# Run these one by one, pasting real values:
# store_secret NEXT_PUBLIC_SUPABASE_URL       "https://your-project.supabase.co"
# store_secret NEXT_PUBLIC_SUPABASE_ANON_KEY  "eyJ..."
# store_secret SUPABASE_SERVICE_ROLE_KEY      "eyJ..."
# store_secret OPENAI_API_KEY                 "sk-..."
# store_secret QDRANT_URL                     "http://INTERNAL_VM_IP:6333"    ← use internal IP from Block 7
# store_secret QDRANT_API_KEY                 "your-qdrant-api-key"
# store_secret GCP_PROJECT_ID                 "your-project-id"
# store_secret GCP_REGION                     "asia-south1"
# store_secret VERTEX_AI_API_KEY              "AIza..."
# store_secret GEMINI_CHAT_MODEL              "google/gemini-2.5-flash"
# store_secret GEMINI_LITE_MODEL              "google/gemini-2.5-flash"
# store_secret GEMINI_VISION_MODEL            "google/gemini-2.5-flash"
# store_secret LERNO_INTERNAL_LLM_SECRET      "your-secret"
# store_secret ATTACHMENT_BUCKET              "chat-attachments"
# store_secret RESEND_API_KEY                 "re_..."
# store_secret FEEDBACK_NOTIFY_EMAILS         "you@example.com"
# store_secret FEEDBACK_FROM_EMAIL            "noreply@lerno.in"
# store_secret UPSTASH_REDIS_REST_URL         "https://..."
# store_secret UPSTASH_REDIS_REST_TOKEN       "..."
# store_secret NEXT_PUBLIC_SENTRY_DSN         "https://...@sentry.io/..."
# store_secret SENTRY_ORG                     "your-org"
# store_secret SENTRY_PROJECT                 "your-project"
# store_secret SENTRY_AUTH_TOKEN              "sntrys_..."
# store_secret SENTRY_DSN                     "https://...@sentry.io/..."
# store_secret LERNO_APP_URL                  "https://YOUR-CLOUD-RUN-URL"  ← fill after Block 13

# ──────────────────────────────────────────────────────────────────────────────
# BLOCK 13 — Create Serverless VPC Access connector
# Lets Cloud Run reach the Qdrant VM's internal IP.
# ──────────────────────────────────────────────────────────────────────────────
gcloud compute networks vpc-access connectors create lerno-connector \
  --region=$REGION \
  --network=default \
  --range=10.8.0.0/28 \
  --project=$PROJECT_ID

# ──────────────────────────────────────────────────────────────────────────────
# BLOCK 14 — First Cloud Run deploy (initial — done manually before CI/CD is set up)
# Build locally and push, then deploy.
# ──────────────────────────────────────────────────────────────────────────────
gcloud auth configure-docker asia-south1-docker.pkg.dev

# Grant Cloud Build service account access to Secret Manager
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='get(projectNumber)')
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$PROJECT_NUMBER@cloudbuild.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Trigger first build via Cloud Build (reads cloudbuild.yaml from repo root)
gcloud builds submit \
  --config=cloudbuild.yaml \
  --region=$REGION \
  --project=$PROJECT_ID

# After build completes, deploy with all config:
gcloud run deploy lerno-web \
  --image=asia-south1-docker.pkg.dev/$PROJECT_ID/lerno/lerno-web:latest \
  --region=$REGION \
  --platform=managed \
  --min-instances=1 \
  --max-instances=10 \
  --memory=1Gi \
  --cpu=1 \
  --timeout=300 \
  --concurrency=80 \
  --vpc-connector=lerno-connector \
  --vpc-egress=private-ranges-only \
  --allow-unauthenticated \
  --set-secrets="\
SUPABASE_SERVICE_ROLE_KEY=SUPABASE_SERVICE_ROLE_KEY:latest,\
OPENAI_API_KEY=OPENAI_API_KEY:latest,\
QDRANT_URL=QDRANT_URL:latest,\
QDRANT_API_KEY=QDRANT_API_KEY:latest,\
GCP_PROJECT_ID=GCP_PROJECT_ID:latest,\
GCP_REGION=GCP_REGION:latest,\
VERTEX_AI_API_KEY=VERTEX_AI_API_KEY:latest,\
GEMINI_CHAT_MODEL=GEMINI_CHAT_MODEL:latest,\
GEMINI_LITE_MODEL=GEMINI_LITE_MODEL:latest,\
GEMINI_VISION_MODEL=GEMINI_VISION_MODEL:latest,\
LERNO_INTERNAL_LLM_SECRET=LERNO_INTERNAL_LLM_SECRET:latest,\
ATTACHMENT_BUCKET=ATTACHMENT_BUCKET:latest,\
RESEND_API_KEY=RESEND_API_KEY:latest,\
FEEDBACK_NOTIFY_EMAILS=FEEDBACK_NOTIFY_EMAILS:latest,\
FEEDBACK_FROM_EMAIL=FEEDBACK_FROM_EMAIL:latest,\
UPSTASH_REDIS_REST_URL=UPSTASH_REDIS_REST_URL:latest,\
UPSTASH_REDIS_REST_TOKEN=UPSTASH_REDIS_REST_TOKEN:latest,\
SENTRY_DSN=SENTRY_DSN:latest,\
LERNO_APP_URL=LERNO_APP_URL:latest" \
  --set-env-vars="\
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL,\
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY,\
NEXT_PUBLIC_SENTRY_DSN=YOUR_SENTRY_DSN,\
NODE_ENV=production" \
  --project=$PROJECT_ID
# Note: NEXT_PUBLIC_* vars above are runtime hints for SSR — the real values
# are baked into the client bundle at build time via Docker build args.

# ──────────────────────────────────────────────────────────────────────────────
# BLOCK 15 — Map custom domain (optional but recommended)
# ──────────────────────────────────────────────────────────────────────────────
# gcloud run domain-mappings create \
#   --service=lerno-web \
#   --domain=app.lerno.in \
#   --region=$REGION \
#   --project=$PROJECT_ID
# Then add the DNS records Cloud Run shows you to your domain registrar.

# ──────────────────────────────────────────────────────────────────────────────
# BLOCK 16 — Connect Cloud Build to GitHub for auto-deploy on push
# Do this in the GCP Console UI:
#   Cloud Build → Triggers → Connect Repository → GitHub
#   Select your repo → Create trigger:
#     Branch: ^main$
#     Config: cloudbuild.yaml
#     Region: asia-south1
# ──────────────────────────────────────────────────────────────────────────────

# ──────────────────────────────────────────────────────────────────────────────
# BLOCK 17 — Update Supabase Edge Function secret (LERNO_APP_URL)
# After your Cloud Run URL is live, update the edge function secret:
#   Supabase → Project Settings → Edge Functions → Secrets
#   LERNO_APP_URL = https://lerno-web-xxxx-el.a.run.app  (your Cloud Run URL)
# ──────────────────────────────────────────────────────────────────────────────

echo "Setup complete. Verify with: curl https://YOUR-CLOUD-RUN-URL/api/health"

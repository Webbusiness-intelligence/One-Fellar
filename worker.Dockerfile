# Ad Studio render worker — Render Background Worker image.
# Includes ffmpeg (for the cut-to-cut stitcher) which Render's native Node env lacks.
FROM node:24-slim

# ffmpeg + ffprobe for video stitching
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install deps (include dev so tsx is available to run the TS worker)
COPY package.json package-lock.json* ./
RUN npm install --include=dev --no-audit --no-fund

# App source (node_modules / .next / .env* excluded via .dockerignore)
COPY . .

# Long-running queue worker. Reads from the environment (set these in Render):
#   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, FAL_KEY, GEMINI_API_KEY
#   (optional) WORKER_CONCURRENCY (default 3), WORKER_MAX_PER_ACCOUNT (default 2)
CMD ["npm", "run", "worker"]

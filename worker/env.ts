// Load .env.local / .env into process.env BEFORE any lib module that reads env at
// import time (cinematic-director reads GEMINI_API_KEY, fal reads FAL_KEY, etc.).
// This file must be the FIRST import in worker/index.ts.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

for (const file of [".env.local", ".env"]) {
  try {
    const txt = readFileSync(resolve(process.cwd(), file), "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const key = m[1];
      const val = m[2].trim().replace(/^['"]|['"]$/g, "");
      if (process.env[key] === undefined) process.env[key] = val;
    }
  } catch {
    /* file optional */
  }
}

for (const req of ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "FAL_KEY", "GEMINI_API_KEY"]) {
  if (!process.env[req]) console.warn(`[worker] WARNING: ${req} is not set`);
}

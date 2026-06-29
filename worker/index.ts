// Ad Studio worker. Drains the ad_jobs queue: claim (SKIP LOCKED) → run the
// pipeline → settle (true-up credits) or refund (on failure). Runs a fixed
// concurrency pool (the throttle that keeps fal/Gemini/ffmpeg load bounded),
// a stale-job reaper, and drains in-flight jobs on shutdown.
//
// Run locally:  npm run worker   (alongside `npm run dev`)
// Env:          WORKER_CONCURRENCY (default 3), WORKER_MAX_PER_ACCOUNT (default 2)
import "./env"; // MUST be first — loads keys before db/lib modules read them

import { randomUUID } from "node:crypto";
import { claimJob, settle, refund, requeueStale, type Job } from "./db";
import { runImageJob } from "./run-image";
import { runVideoJob } from "./run-video";
import { runSoulJob } from "./run-soul";

const WORKER_ID = `w-${process.pid}-${randomUUID().slice(0, 8)}`;
const CONCURRENCY = Number(process.env.WORKER_CONCURRENCY) || 3;
const MAX_PER_ACCOUNT = Number(process.env.WORKER_MAX_PER_ACCOUNT) || 2;
const IDLE_MS = 1500; // poll interval when the queue is empty
const REAPER_MS = 60_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let running = 0;
let stopping = false;

async function processJob(job: Job): Promise<void> {
  const started = Date.now();
  try {
    let actual: number;
    if (job.type === "video") actual = await runVideoJob(job);
    else if (job.type === "image") actual = await runImageJob(job);
    else if (job.type === "soul") actual = await runSoulJob(job);
    else throw new Error(`unknown job type: ${job.type}`);
    await settle(job.id, actual);
    console.log(`[worker] ✓ ${job.type} ${job.id} · ${actual}cr · ${((Date.now() - started) / 1000).toFixed(0)}s`);
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    await refund(job.id, msg);
    console.error(`[worker] ✗ ${job.type} ${job.id} · ${msg}`);
  } finally {
    running--;
  }
}

async function loop(): Promise<void> {
  while (!stopping) {
    if (running >= CONCURRENCY) {
      await sleep(200);
      continue;
    }
    const job = await claimJob(WORKER_ID, MAX_PER_ACCOUNT);
    if (!job) {
      await sleep(IDLE_MS);
      continue;
    }
    running++;
    console.log(`[worker] claimed ${job.type} ${job.id} (in flight: ${running})`);
    void processJob(job); // don't await — keep filling the pool
  }
}

async function main(): Promise<void> {
  console.log(`[worker] ${WORKER_ID} up · concurrency ${CONCURRENCY} · max/account ${MAX_PER_ACCOUNT}`);

  const reaper = setInterval(async () => {
    const n = await requeueStale(15);
    if (n) console.log(`[worker] reaper requeued ${n} stale job(s)`);
  }, REAPER_MS);

  const shutdown = async (sig: string) => {
    if (stopping) return;
    console.log(`[worker] ${sig} — draining ${running} in-flight job(s)…`);
    stopping = true;
    clearInterval(reaper);
    const deadline = Date.now() + 600_000; // wait up to 10 min for in-flight work
    while (running > 0 && Date.now() < deadline) await sleep(500);
    console.log("[worker] bye");
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));

  await loop();
}

void main();

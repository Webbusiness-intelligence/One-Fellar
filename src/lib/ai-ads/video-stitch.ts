// Stitches separately-rendered shots into one cut-to-cut video with ffmpeg's xfade
// filter. Hard cuts use a 1-frame crossfade (visually instant); dissolve / fade /
// whip are real cinematic transitions. Video-only (cut-mode clips are silent).
//
// Binary resolution: FFMPEG_PATH / FFPROBE_PATH env override → bundled static
// binaries (ffmpeg-static / ffprobe-static, works on Render + local) → system PATH.

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import type { CutTransition } from "./cinematic-director";

const req = createRequire(import.meta.url);
function resolveBin(envPath: string | undefined, pkg: string, fallback: string): string {
  if (envPath) return envPath;
  try {
    const m = req(pkg) as string | { path?: string } | null;
    const p = typeof m === "string" ? m : m?.path;
    if (p) return p;
  } catch {
    /* package not installed — fall back to system binary */
  }
  return fallback;
}
const FFMPEG = resolveBin(process.env.FFMPEG_PATH, "ffmpeg-static", "ffmpeg");
const FFPROBE = resolveBin(process.env.FFPROBE_PATH, "ffprobe-static", "ffprobe");

// xfade transition name + duration (seconds) per our transition kinds.
const XFADE: Record<CutTransition, { name: string; dur: number }> = {
  cut: { name: "fade", dur: 0.05 }, // ~1 frame — visually a hard cut
  dissolve: { name: "dissolve", dur: 0.4 },
  fade: { name: "fadeblack", dur: 0.5 },
  whip: { name: "smoothleft", dur: 0.25 },
};

function run(cmd: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args);
    let out = "";
    let err = "";
    p.stdout.on("data", (d) => (out += d.toString()));
    p.stderr.on("data", (d) => (err += d.toString()));
    p.on("error", reject);
    p.on("close", (code) =>
      code === 0 ? resolve(out) : reject(new Error(`${cmd} exited ${code}: ${err.slice(-500)}`)),
    );
  });
}

async function probe(path: string): Promise<{ duration: number; width: number; height: number; fps: number }> {
  const out = await run(FFPROBE, [
    "-v",
    "error",
    "-select_streams",
    "v:0",
    "-show_entries",
    "stream=width,height,r_frame_rate:format=duration",
    "-of",
    "default=noprint_wrappers=1:nokey=1",
    path,
  ]);
  // Prints width, height, r_frame_rate, duration (one per line).
  const lines = out.trim().split(/\s+/);
  const width = parseInt(lines[0], 10) || 1280;
  const height = parseInt(lines[1], 10) || 720;
  const [n, d] = (lines[2] || "30/1").split("/").map(Number);
  const fps = d ? n / d : 30;
  const duration = parseFloat(lines[3]) || 0;
  return { duration, width, height, fps: Math.round(fps) || 30 };
}

// Re-encode a clip to fit under a byte budget: capped-bitrate H.264 at the SAME
// resolution, audio kept (AAC 128k). Used when a rendered clip exceeds the
// Supabase bucket's 50 MB upload cap so a paid render is never lost.
export async function transcodeToFit(src: string, out: string, videoKbps: number): Promise<void> {
  await run(FFMPEG, [
    "-i", src,
    "-c:v", "libx264",
    "-preset", "fast",
    "-b:v", `${videoKbps}k`,
    "-maxrate", `${videoKbps}k`,
    "-bufsize", `${videoKbps * 2}k`,
    "-pix_fmt", "yuv420p",
    "-c:a", "aac",
    "-b:a", "128k",
    "-movflags", "+faststart",
    "-y", out,
  ]);
}

// Stitch clips (in order). `transition` is the transition INTO each clip; the first
// clip's transition is ignored. Writes the result to `outPath` (mp4, H.264, silent).
export async function stitchClips(
  clips: { path: string; transition: CutTransition }[],
  outPath: string,
): Promise<void> {
  if (!clips.length) throw new Error("stitchClips: no clips");

  const base = await probe(clips[0].path);
  const W = base.width;
  const H = base.height;
  const FPS = base.fps;

  // Normalise every input to identical W×H, fps, SAR and pixel format so xfade accepts them.
  const norm = (i: number, label: string) =>
    `[${i}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,` +
    `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${FPS},format=yuv420p[${label}];`;

  let filter = "";
  clips.forEach((_, i) => (filter += norm(i, `v${i}`)));

  const allCut = clips.every((c) => c.transition === "cut");
  if (clips.length === 1) {
    filter += `[v0]null[vout]`;
  } else if (allCut) {
    // True hard cuts — concatenate the normalised streams with NO overlap/blend.
    filter += `${clips.map((_, i) => `[v${i}]`).join("")}concat=n=${clips.length}:v=1:a=0[vout]`;
  } else {
    const durs = await Promise.all(clips.map((c) => probe(c.path).then((p) => p.duration)));
    let prev = "v0";
    let L = durs[0]; // running length of the accumulated stream
    for (let k = 1; k < clips.length; k++) {
      const { name, dur } = XFADE[clips[k].transition] ?? XFADE.cut;
      const d = Math.min(dur, Math.max(0.05, durs[k] - 0.1), Math.max(0.05, L - 0.1));
      const offset = Math.max(0, L - d);
      const out = k === clips.length - 1 ? "vout" : `x${k}`;
      filter += `[${prev}][v${k}]xfade=transition=${name}:duration=${d.toFixed(3)}:offset=${offset.toFixed(3)}[${out}];`;
      L = L + durs[k] - d;
      prev = out;
    }
  }
  filter = filter.replace(/;$/, "");

  const args: string[] = [];
  clips.forEach((c) => args.push("-i", c.path));
  args.push(
    "-filter_complex",
    filter,
    "-map",
    "[vout]",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "18",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-an",
    "-y",
    outPath,
  );
  await run(FFMPEG, args);
}

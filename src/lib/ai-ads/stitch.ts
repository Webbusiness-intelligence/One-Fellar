// Stitch shot clips into one film with ffmpeg (re-encoded so clips concat cleanly).
// Server-only; expects ffmpeg on PATH. Returns the final mp4 as a Buffer.

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile, mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const execFileP = promisify(execFile);

// Windows CreateProcess searches PATH but won't auto-append .exe, so be explicit.
const FFMPEG =
  process.env.FFMPEG_PATH || (process.platform === "win32" ? "ffmpeg.exe" : "ffmpeg");
const FFPROBE =
  process.env.FFPROBE_PATH || (process.platform === "win32" ? "ffprobe.exe" : "ffprobe");

// Duration (seconds) of an mp4 buffer, via ffprobe. 0 on failure.
export async function probeDuration(video: Buffer): Promise<number> {
  const dir = await mkdtemp(join(tmpdir(), "adprobe-"));
  try {
    const f = join(dir, "p.mp4");
    await writeFile(f, video);
    const { stdout } = await execFileP(
      FFPROBE,
      ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", f],
      { timeout: 30000 },
    );
    return Math.round(parseFloat(stdout.trim()) || 0);
  } catch {
    return 0;
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function stitchVideos(urls: string[]): Promise<Buffer> {
  if (urls.length === 1) {
    return Buffer.from(await (await fetch(urls[0])).arrayBuffer());
  }
  const dir = await mkdtemp(join(tmpdir(), "adcom-"));
  try {
    const files: string[] = [];
    for (let i = 0; i < urls.length; i++) {
      const buf = Buffer.from(await (await fetch(urls[i])).arrayBuffer());
      const f = join(dir, `clip${i}.mp4`);
      await writeFile(f, buf);
      files.push(f.replace(/\\/g, "/")); // ffmpeg concat list prefers forward slashes
    }
    const listPath = join(dir, "list.txt");
    await writeFile(listPath, files.map((f) => `file '${f}'`).join("\n"));
    const outPath = join(dir, "final.mp4");
    await execFileP(
      FFMPEG,
      [
        "-y",
        "-f", "concat",
        "-safe", "0",
        "-i", listPath,
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "18",
        "-c:a", "aac",
        "-b:a", "192k",
        "-pix_fmt", "yuv420p",
        "-movflags", "+faststart",
        outPath,
      ],
      { maxBuffer: 1024 * 1024 * 64, timeout: 240000 },
    );
    return await readFile(outPath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

// Mix extra audio tracks (music bed, voiceover) under a video's own audio.
// baseVolume = the clip's existing SFX/ambient level; each track has its own volume.
export async function muxTracks(
  video: Buffer,
  tracks: Array<{ url: string; volume: number }>,
  baseVolume = 0.6,
): Promise<Buffer> {
  if (!tracks.length) return video;
  const dir = await mkdtemp(join(tmpdir(), "admux-"));
  try {
    const vid = join(dir, "in.mp4");
    await writeFile(vid, video);

    // The base video may be SILENT (e.g. Kling Turbo clips have no audio) — only
    // reference [0:a] in the mix if an audio stream actually exists.
    let hasAudio = false;
    let vidDur = 0;
    try {
      const { stdout } = await execFileP(
        FFPROBE,
        ["-v", "error", "-show_entries", "format=duration:stream=codec_type", "-of", "default=nw=1", vid],
        { timeout: 30000 },
      );
      hasAudio = /codec_type=audio/.test(stdout);
      vidDur = parseFloat((stdout.match(/duration=([\d.]+)/) || [])[1] || "0") || 0;
    } catch {
      /* assume no audio */
    }

    const inputs: string[] = ["-i", vid];
    const filterParts: string[] = [];
    const mixLabels: string[] = [];
    if (hasAudio) {
      filterParts.push(`[0:a]volume=${baseVolume}[a0]`);
      mixLabels.push("[a0]");
    }
    for (let i = 0; i < tracks.length; i++) {
      const f = join(dir, `t${i}`);
      await writeFile(f, Buffer.from(await (await fetch(tracks[i].url)).arrayBuffer()));
      inputs.push("-i", f.replace(/\\/g, "/"));
      filterParts.push(`[${i + 1}:a]volume=${tracks[i].volume}[t${i}]`);
      mixLabels.push(`[t${i}]`);
    }

    // One source → no amix (invalid for a single input); rename it to [aout].
    let audioOut = "[aout]";
    if (mixLabels.length === 1) {
      audioOut = mixLabels[0];
    } else {
      filterParts.push(
        `${mixLabels.join("")}amix=inputs=${mixLabels.length}:duration=longest:normalize=0[aout]`,
      );
    }

    const out = join(dir, "out.mp4");
    await execFileP(
      FFMPEG,
      [
        "-y",
        ...inputs,
        "-filter_complex", filterParts.join(";"),
        "-map", "0:v",
        "-map", audioOut,
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "192k",
        ...(vidDur > 0 ? ["-t", String(vidDur)] : []), // cap audio tail to the video length
        "-movflags", "+faststart",
        out,
      ],
      { maxBuffer: 1024 * 1024 * 64, timeout: 180000 },
    );
    return await readFile(out);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

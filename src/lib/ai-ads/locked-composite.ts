// Fidelity-locked compositing: generate a product-free background scene, then
// paste the REAL product cutout on top. The product pixels are never
// regenerated, so logos/labels/shape are guaranteed exact. Server-only.

import sharp from "sharp";

import { falRun } from "./fal";
import { FORMAT_DIMS } from "./generate-image";

// Background size for flux: the right aspect, capped so flux stays happy.
function bgSize(format: string): { width: number; height: number } {
  const [w, h] = FORMAT_DIMS[format] ?? [1024, 1024];
  const s = 1280 / Math.max(w, h);
  const r8 = (n: number) => Math.max(256, Math.round((n * s) / 8) * 8);
  return { width: r8(w), height: r8(h) };
}

export async function lockedComposite(opts: {
  scene: string;
  cutoutUrl: string;
  format: string;
}): Promise<Buffer> {
  const bg = await falRun<{ images?: Array<{ url: string }> }>("fal-ai/flux/schnell", {
    prompt: `${opts.scene} An empty product-photography scene with NO product present — just the background, surface, props and lighting, leaving clear space in the lower-centre for a product to be placed.`,
    image_size: bgSize(opts.format),
    num_images: 1,
    num_inference_steps: 4,
  });
  const bgUrl = bg.images?.[0]?.url;
  if (!bgUrl) throw new Error("background generation failed");

  const bgBuf = Buffer.from(await (await fetch(bgUrl)).arrayBuffer());
  const cutBuf = Buffer.from(await (await fetch(opts.cutoutUrl)).arrayBuffer());

  const meta = await sharp(bgBuf).metadata();
  const W = meta.width ?? 1024;
  const H = meta.height ?? 1024;

  // Scale the product to ~60% of the canvas height, anchored bottom-centre.
  const cut = await sharp(cutBuf)
    .resize({ height: Math.round(H * 0.6), fit: "inside" })
    .png()
    .toBuffer();
  const cutMeta = await sharp(cut).metadata();
  const cw = cutMeta.width ?? Math.round(H * 0.6);
  const ch = cutMeta.height ?? Math.round(H * 0.6);
  const left = Math.max(0, Math.round((W - cw) / 2));
  const top = Math.max(0, Math.round(H * 0.92 - ch));

  // Soft contact shadow so the product doesn't look pasted.
  const shadowW = Math.round(cw * 0.9);
  const shadowH = Math.round(Math.max(8, ch * 0.08));
  const shadow = Buffer.from(
    `<svg width="${shadowW}" height="${shadowH}" xmlns="http://www.w3.org/2000/svg"><ellipse cx="${shadowW / 2}" cy="${shadowH / 2}" rx="${shadowW / 2}" ry="${shadowH / 2}" fill="black" fill-opacity="0.28"/></svg>`,
  );
  const shadowBlurred = await sharp(shadow).blur(6).png().toBuffer();

  return sharp(bgBuf)
    .composite([
      {
        input: shadowBlurred,
        left: Math.max(0, Math.round((W - shadowW) / 2)),
        top: Math.min(H - shadowH, Math.round(top + ch - shadowH / 2)),
      },
      { input: cut, left, top },
    ])
    .png()
    .toBuffer();
}

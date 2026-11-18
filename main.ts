// THE WORLD TODAY — Tuesday 17 November 2026.
// A one-page newspaper front page, drawn entirely in code (Node 22 stdlib only).
// No network, no dependencies, no embedded fonts: every glyph below is a vector
// stroke drawn by this program, and the PNG is encoded by hand.
//
// Run:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Output: /output/entry.png (or $MAKEFUN_OUTPUT_DIR/entry.png), 1024x1024.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { createHash } from 'node:crypto';

export const W = 1024;
export const H = 1024;

export type RGB = [number, number, number];
export const PAPER: RGB = [246, 241, 230];
export const INK: RGB = [26, 26, 26];
export const RED: RGB = [178, 32, 42];
export const GRAY: RGB = [122, 118, 106];
export const PANEL_BG: RGB = [234, 229, 215];
export const NAVY: RGB = [32, 48, 74];
export const SKY: RGB = [146, 172, 198];
export const SAND: RGB = [203, 178, 128];
export const GOLD: RGB = [214, 164, 32];

// ---------------------------------------------------------------- canvas ---
const px = new Uint8Array(W * H * 3);

export function setPx(x: number, y: number, c: RGB): void {
  const ix = Math.round(x);
  const iy = Math.round(y);
  if (ix < 0 || iy < 0 || ix >= W || iy >= H) return;
  const o = (iy * W + ix) * 3;
  px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2];
}

export function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(W, Math.round(x + w));
  const y1 = Math.min(H, Math.round(y + h));
  for (let yy = y0; yy < y1; yy++) {
    let o = (yy * W + x0) * 3;
    for (let xx = x0; xx < x1; xx++) {
      px[o] = c[0]; px[o + 1] = c[1]; px[o + 2] = c[2];
      o += 3;
    }
  }
}

// A thick line: walk the segment and stamp a square brush at each step.
export function line(x0: number, y0: number, x1: number, y1: number, t: number, c: RGB): void {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) * 2));
  const r = Math.floor(t / 2);
  for (let i = 0; i <= steps; i++) {
    const f = i / steps;
    const cx = Math.round(x0 + dx * f);
    const cy = Math.round(y0 + dy * f);
    for (let a = -r; a <= r; a++) {
      for (let b = -r; b <= r; b++) setPx(cx + a, cy + b, c);
    }
  }
}

export function polyline(pts: number[], t: number, c: RGB): void {
  for (let i = 0; i + 3 < pts.length + 1; i += 2) {
    line(pts[i], pts[i + 1], pts[i + 2], pts[i + 3], t, c);
  }
}

// Filled polygon (scanline fill). pts is a flat [x0,y0,x1,y1,...] list.
export function fillPoly(pts: number[], c: RGB): void {
  const n = pts.length / 2;
  let minY = H;
  let maxY = 0;
  for (let i = 0; i < n; i++) {
    minY = Math.min(minY, pts[i * 2 + 1]);
    maxY = Math.max(maxY, pts[i * 2 + 1]);
  }
  for (let y = Math.max(0, Math.ceil(minY)); y <= Math.min(H - 1, Math.floor(maxY)); y++) {
    const xs: number[] = [];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const x0 = pts[i * 2];
      const y0 = pts[i * 2 + 1];
      const x1 = pts[j * 2];
      const y1 = pts[j * 2 + 1];
      if ((y0 <= y && y1 > y) || (y1 <= y && y0 > y)) {
        xs.push(x0 + ((y - y0) / (y1 - y0)) * (x1 - x0));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      for (let x = Math.max(0, Math.ceil(xs[k])); x <= Math.min(W - 1, Math.floor(xs[k + 1])); x++) {
        setPx(x, y, c);
      }
    }
  }
}

export function circle(cx: number, cy: number, r: number, c: RGB, filled: boolean): void {
  const rr = Math.round(r);
  for (let dy = -rr; dy <= rr; dy++) {
    for (let dx = -rr; dx <= rr; dx++) {
      const d = Math.sqrt(dx * dx + dy * dy);
      if (filled ? d <= r : Math.abs(d - r) < 1.1) setPx(cx + dx, cy + dy, c);
    }
  }
}

// A starburst (explosion) centred at (cx, cy).
export function starburst(cx: number, cy: number, rOut: number, rIn: number, spikes: number, c: RGB): void {
  const pts: number[] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? rOut : rIn;
    pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  fillPoly(pts, c);
}

// ------------------------------------------------------------- vector font ---
// Each glyph is a list of polylines on a 6-wide, 8-tall grid (y down, 0 = top).
// The '9' is a closed bowl on top plus a straight stem down the right side:
// it must read as a 9, never as an 8.
export const FONT: Record<string, number[][]> = {
  A: [[0, 7, 2.5, 0, 5, 7], [1.3, 4.5, 3.7, 4.5]],
  B: [[0, 0, 0, 7], [0, 0, 3.5, 0, 5, 1.5, 3.5, 3.5], [0, 3.5, 3.5, 3.5, 5, 5, 3.5, 7, 0, 7]],
  C: [[5, 1.5, 4, 0.5, 2, 0, 0.5, 1, 0, 3.5, 0.5, 6, 2, 7, 4, 7, 5, 5.5]],
  D: [[0, 0, 0, 7], [0, 0, 3, 0, 5, 1.5, 5, 5.5, 3, 7, 0, 7]],
  E: [[0, 0, 0, 7], [0, 0, 4.5, 0], [0, 3.5, 3.5, 3.5], [0, 7, 4.5, 7]],
  F: [[0, 0, 0, 7], [0, 0, 4.5, 0], [0, 3.5, 3.5, 3.5]],
  G: [[5, 1.5, 4, 0.5, 2, 0, 0.5, 1, 0, 3.5, 0.5, 6, 2, 7, 4, 7, 5, 5.5, 5, 4, 3, 4]],
  H: [[0, 0, 0, 7], [5, 0, 5, 7], [0, 3.5, 5, 3.5]],
  I: [[1, 0, 4, 0], [2.5, 0, 2.5, 7], [1, 7, 4, 7]],
  J: [[4, 0, 4, 5.5, 3, 7, 1, 7, 0, 5.5]],
  K: [[0, 0, 0, 7], [4.5, 0, 0.5, 3.5], [2, 4.5, 4.5, 7]],
  L: [[0, 0, 0, 7], [0, 7, 4.5, 7]],
  M: [[0, 7, 0, 0, 2.5, 3.5, 5, 0, 5, 7]],
  N: [[0, 7, 0, 0, 5, 7, 5, 0]],
  O: [[1, 0, 4, 0, 5, 1.5, 5, 5.5, 4, 7, 1, 7, 0, 5.5, 0, 1.5, 1, 0]],
  P: [[0, 0, 0, 7], [0, 0, 3.5, 0, 5, 1.5, 3.5, 3.5, 0, 3.5]],
  Q: [[1, 0, 4, 0, 5, 1.5, 5, 5.5, 4, 7, 1, 7, 0, 5.5, 0, 1.5, 1, 0], [3, 5, 5, 7]],
  R: [[0, 0, 0, 7], [0, 0, 3.5, 0, 5, 1.5, 3.5, 3.5, 0, 3.5], [2.5, 3.5, 5, 7]],
  S: [[4.5, 1, 3, 0, 1, 0.5, 0.5, 2, 1, 3.5, 3.5, 3.5, 5, 5, 4, 7, 2, 7, 0.5, 6]],
  T: [[0, 0, 5, 0], [2.5, 0, 2.5, 7]],
  U: [[0, 0, 0, 5.5, 1, 7, 4, 7, 5, 5.5, 5, 0]],
  V: [[0, 0, 2.5, 7, 5, 0]],
  W: [[0, 0, 1.2, 7, 2.5, 3, 3.8, 7, 5, 0]],
  X: [[0, 0, 5, 7], [5, 0, 0, 7]],
  Y: [[0, 0, 2.5, 3.5, 5, 0], [2.5, 3.5, 2.5, 7]],
  Z: [[0, 0, 5, 0, 0, 7, 5, 7]],
  '0': [[1, 0, 4, 0, 5, 1.5, 5, 5.5, 4, 7, 1, 7, 0, 5.5, 0, 1.5, 1, 0]],
  '1': [[1, 1.5, 2.5, 0, 2.5, 7], [0.5, 7, 4.5, 7]],
  '2': [[0.5, 1.5, 1.5, 0, 3.5, 0, 5, 1.5, 5, 3, 0, 7, 5, 7]],
  '3': [[0.5, 0.5, 2, 0, 4, 0.5, 5, 2, 4, 3.5, 2, 3.5], [4, 3.5, 5, 5, 4, 7, 2, 7, 0.5, 6.5]],
  '4': [[0, 0, 0, 4, 4.5, 4], [3.5, 0, 3.5, 7]],
  '5': [[4.5, 0, 0.5, 0, 0.5, 3, 3, 3, 4.5, 4.5, 4.5, 6, 2.5, 7, 0.5, 6.5]],
  '6': [[4.5, 0.5, 2, 0, 0.5, 1.5, 0, 4, 0, 5.5, 1.5, 7, 3.5, 7, 5, 5.5, 5, 4, 3.5, 3.5, 1.5, 3.5]],
  '7': [[0, 0, 5, 0, 1.5, 7]],
  '8': [[1.5, 0.5, 3.5, 0.5, 4.8, 1.8, 3.8, 3.5, 1.2, 3.5, 0.2, 1.8, 1.5, 0.5], [1.2, 3.5, 3.8, 3.5, 5, 5, 4, 7, 1, 7, 0, 5, 1.2, 3.5]],
  // 9: closed bowl on top, straight stem down the right side. NOT a double loop.
  '9': [[1, 0.5, 3, 0, 4.5, 0.5, 5, 2, 4, 3.5, 2, 3.5, 0.5, 2, 1, 0.5], [5, 2, 5, 7]],
  '.': [[2, 6.2, 3, 6.2, 3, 7.2, 2, 7.2, 2, 6.2]],
  ',': [[2, 5.5, 3, 5.5, 3, 6.5, 2, 6.5, 2, 5.5], [2.5, 6.5, 1.5, 7.5]],
  ':': [[2, 2, 3, 2, 3, 3, 2, 3, 2, 2], [2, 5, 3, 5, 3, 6, 2, 6, 2, 5]],
  ';': [[2, 2, 3, 2, 3, 3, 2, 3, 2, 2], [2.5, 4, 2.5, 6.5, 1.5, 7.5]],
  '!': [[2.5, 0, 2.5, 5], [2, 6.2, 3, 6.2, 3, 7.2, 2, 7.2, 2, 6.2]],
  '?': [[1, 1, 2, 0, 4, 0, 5, 1.5, 4, 3, 2.5, 3.5, 2.5, 5], [2, 6.2, 3, 6.2, 3, 7.2, 2, 7.2, 2, 6.2]],
  "'": [[2.5, 0, 2, 2]],
  '-': [[0.5, 3.5, 4.5, 3.5]],
  '(': [[3.5, 0, 2, 1.5, 2, 5.5, 3.5, 7]],
  ')': [[1.5, 0, 3, 1.5, 3, 5.5, 1.5, 7]],
  '/': [[4, 0, 1, 7]],
  $: [[4, 1, 3, 0, 1, 0.5, 0.5, 2, 1.5, 3.5, 3.5, 3.5, 5, 5, 4, 7, 2, 7, 0.5, 6], [2.5, 0, 2.5, 7]],
  ' ': [],
};

// Draw text at (x, y) = top-left of the first glyph's box. align is relative to x.
export function drawText(
  text: string,
  x: number,
  y: number,
  scale: number,
  c: RGB,
  align: 'left' | 'center' | 'right' = 'left',
): void {
  const adv = 7 * scale;
  const w = text.length * adv - scale;
  let sx = x;
  if (align === 'center') sx = x - w / 2;
  if (align === 'right') sx = x - w;
  const t = Math.max(1, Math.round(scale * 0.32));
  for (let i = 0; i < text.length; i++) {
    const g = FONT[text[i]];
    if (!g) continue;
    const ox = sx + i * adv;
    for (const pl of g) {
      for (let k = 0; k + 3 < pl.length + 1; k += 2) {
        line(ox + pl[k] * scale, y + pl[k + 1] * scale, ox + pl[k + 2] * scale, y + pl[k + 3] * scale, t, c);
      }
    }
  }
}

export function textWidth(text: string, scale: number): number {
  return text.length * 7 * scale - scale;
}

// Greedy word wrap for the fixed-advance font.
export function wrapText(text: string, width: number, scale: number): string[] {
  const maxChars = Math.max(1, Math.floor(width / (7 * scale)));
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const trial = cur ? cur + ' ' + w : w;
    if (trial.length <= maxChars) {
      cur = trial;
    } else {
      if (cur) lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

// Draw a wrapped paragraph; returns the y just below the last line.
export function drawPara(text: string, x: number, y: number, width: number, scale: number, c: RGB, lh: number): number {
  const lines = wrapText(text, width, scale);
  for (let i = 0; i < lines.length; i++) {
    drawText(lines[i], x, y + i * lh, scale, c);
  }
  return y + lines.length * lh;
}

// ------------------------------------------------------------------- PNG ---
const CRC_TABLE: number[] = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}
export function encodePNG(): Buffer {
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    Buffer.from(px.buffer, y * W * 3, W * 3).copy(raw, y * (1 + W * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type 2 = RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ------------------------------------------------------------- pictograms ---
// Each picture is drawn inside a box (x, y, s) on a light panel background.
// All coordinates are fractions of s so the same code works at any size.

// 1. Kerch Bridge: two towers, a deck, cables, and an explosion over the span.
export function picBridge(x: number, y: number, s: number): void {
  fillRect(x, y, s, s, PANEL_BG);
  fillRect(x, y + s * 0.72, s, s * 0.28, [168, 196, 214]); // sea
  line(x + s * 0.08, y + s * 0.66, x + s * 0.92, y + s * 0.66, 4, INK); // deck
  fillRect(x + s * 0.2, y + s * 0.3, s * 0.05, s * 0.38, INK); // tower 1
  fillRect(x + s * 0.72, y + s * 0.3, s * 0.05, s * 0.38, INK); // tower 2
  line(x + s * 0.22, y + s * 0.3, x + s * 0.45, y + s * 0.66, 2, INK); // cable
  line(x + s * 0.75, y + s * 0.3, x + s * 0.52, y + s * 0.66, 2, INK); // cable
  line(x + s * 0.22, y + s * 0.3, x + s * 0.08, y + s * 0.66, 2, INK); // cable
  line(x + s * 0.75, y + s * 0.3, x + s * 0.92, y + s * 0.66, 2, INK); // cable
  starburst(x + s * 0.5, y + s * 0.34, s * 0.22, s * 0.1, 9, RED);
  starburst(x + s * 0.5, y + s * 0.34, s * 0.12, s * 0.05, 7, GOLD);
  fillRect(x, y, s, 2, INK);
  fillRect(x, y + s - 2, s, 2, INK);
  fillRect(x, y, 2, s, INK);
  fillRect(x + s - 2, y, 2, s, INK);
}

// 2. Summit: three flags (US, China, Russia) on poles above a skyline.
export function picSummit(x: number, y: number, s: number): void {
  fillRect(x, y, s, s, PANEL_BG);
  fillRect(x, y + s * 0.68, s, s * 0.32, [200, 192, 172]); // ground
  // skyline
  fillRect(x + s * 0.08, y + s * 0.5, s * 0.14, s * 0.2, INK);
  fillRect(x + s * 0.26, y + s * 0.42, s * 0.12, s * 0.28, INK);
  fillRect(x + s * 0.62, y + s * 0.48, s * 0.14, s * 0.22, INK);
  fillRect(x + s * 0.8, y + s * 0.55, s * 0.12, s * 0.15, INK);
  // flag poles
  const poles = [0.22, 0.5, 0.78];
  for (const p of poles) line(x + s * p, y + s * 0.12, x + s * p, y + s * 0.52, 3, INK);
  // US flag: stripes + blue canton
  fillRect(x + s * 0.22, y + s * 0.12, s * 0.2, s * 0.13, [178, 52, 62]);
  fillRect(x + s * 0.22, y + s * 0.155, s * 0.2, s * 0.018, PAPER);
  fillRect(x + s * 0.22, y + s * 0.2, s * 0.2, s * 0.018, PAPER);
  fillRect(x + s * 0.22, y + s * 0.12, s * 0.08, s * 0.07, NAVY);
  // China flag: red field, one gold star
  fillRect(x + s * 0.5, y + s * 0.12, s * 0.2, s * 0.13, RED);
  starburst(x + s * 0.55, y + s * 0.18, s * 0.03, s * 0.014, 5, GOLD);
  // Russia flag: white / blue / red bands
  fillRect(x + s * 0.78, y + s * 0.12, s * 0.18, s * 0.043, PAPER);
  fillRect(x + s * 0.78, y + s * 0.163, s * 0.18, s * 0.043, [52, 86, 158]);
  fillRect(x + s * 0.78, y + s * 0.206, s * 0.18, s * 0.044, RED);
  fillRect(x, y, s, 2, INK);
  fillRect(x, y + s - 2, s, 2, INK);
  fillRect(x, y, 2, s, INK);
  fillRect(x + s - 2, y, 2, s, INK);
}

// 3. Measles: a spiked virus ball with dots.
export function picVirus(x: number, y: number, s: number): void {
  fillRect(x, y, s, s, PANEL_BG);
  const cx = x + s * 0.5;
  const cy = y + s * 0.5;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    line(cx + Math.cos(a) * s * 0.26, cy + Math.sin(a) * s * 0.26, cx + Math.cos(a) * s * 0.4, cy + Math.sin(a) * s * 0.4, 3, RED);
    circle(cx + Math.cos(a) * s * 0.42, cy + Math.sin(a) * s * 0.42, s * 0.03, RED, true);
  }
  circle(cx, cy, s * 0.27, RED, true);
  circle(cx - s * 0.09, cy - s * 0.08, s * 0.05, PAPER, true);
  circle(cx + s * 0.1, cy + s * 0.05, s * 0.04, PAPER, true);
  circle(cx - s * 0.02, cy + s * 0.12, s * 0.03, PAPER, true);
  fillRect(x, y, s, 2, INK);
  fillRect(x, y + s - 2, s, 2, INK);
  fillRect(x, y, 2, s, INK);
  fillRect(x + s - 2, y, 2, s, INK);
}

// 4. Blackout: a dark skyline, most windows out, one lightning bolt.
export function picBlackout(x: number, y: number, s: number): void {
  fillRect(x, y, s, s, NAVY);
  fillRect(x + s * 0.06, y + s * 0.42, s * 0.18, s * 0.58, [18, 26, 42]);
  fillRect(x + s * 0.28, y + s * 0.3, s * 0.16, s * 0.7, [18, 26, 42]);
  fillRect(x + s * 0.48, y + s * 0.5, s * 0.2, s * 0.5, [18, 26, 42]);
  fillRect(x + s * 0.72, y + s * 0.36, s * 0.2, s * 0.64, [18, 26, 42]);
  // two lonely lit windows
  fillRect(x + s * 0.32, y + s * 0.4, s * 0.04, s * 0.05, GOLD);
  fillRect(x + s * 0.78, y + s * 0.5, s * 0.04, s * 0.05, GOLD);
  // lightning bolt
  fillPoly(
    [
      x + s * 0.56, y + s * 0.08, x + s * 0.66, y + s * 0.08, x + s * 0.58, y + s * 0.3,
      x + s * 0.66, y + s * 0.3, x + s * 0.5, y + s * 0.58, x + s * 0.56, y + s * 0.34,
      x + s * 0.48, y + s * 0.34,
    ],
    GOLD,
  );
  fillRect(x, y, s, 2, INK);
  fillRect(x, y + s - 2, s, 2, INK);
  fillRect(x, y, 2, s, INK);
  fillRect(x + s - 2, y, 2, s, INK);
}

// 5. Gaza aid: two tents under rain.
export function picTents(x: number, y: number, s: number): void {
  fillRect(x, y, s, s, PANEL_BG);
  fillRect(x, y + s * 0.74, s, s * 0.26, [188, 176, 148]); // ground
  // rain
  for (let i = 0; i < 7; i++) {
    const rx = x + s * (0.1 + i * 0.13);
    line(rx, y + s * 0.08, rx - s * 0.03, y + s * 0.2, 2, [90, 120, 150]);
  }
  // tent 1
  fillPoly([x + s * 0.08, y + s * 0.74, x + s * 0.28, y + s * 0.44, x + s * 0.48, y + s * 0.74], [206, 188, 150]);
  fillPoly([x + s * 0.24, y + s * 0.74, x + s * 0.28, y + s * 0.6, x + s * 0.32, y + s * 0.74], INK);
  // tent 2
  fillPoly([x + s * 0.52, y + s * 0.74, x + s * 0.7, y + s * 0.38, x + s * 0.88, y + s * 0.74], [196, 176, 138]);
  fillPoly([x + s * 0.66, y + s * 0.74, x + s * 0.7, y + s * 0.58, x + s * 0.74, y + s * 0.74], INK);
  fillRect(x, y, s, 2, INK);
  fillRect(x, y + s - 2, s, 2, INK);
  fillRect(x, y, 2, s, INK);
  fillRect(x + s - 2, y, 2, s, INK);
}

// 6. Japan scrambles jets: a red sun and a climbing fighter jet.
export function picJets(x: number, y: number, s: number): void {
  fillRect(x, y, s, s, PANEL_BG);
  circle(x + s * 0.72, y + s * 0.26, s * 0.16, RED, true);
  // clouds
  fillRect(x + s * 0.08, y + s * 0.3, s * 0.22, s * 0.07, [210, 204, 188]);
  fillRect(x + s * 0.6, y + s * 0.62, s * 0.26, s * 0.07, [210, 204, 188]);
  // jet, nose up-right
  fillPoly(
    [
      x + s * 0.16, y + s * 0.62, x + s * 0.5, y + s * 0.34, x + s * 0.56, y + s * 0.5,
      x + s * 0.82, y + s * 0.44, x + s * 0.6, y + s * 0.58, x + s * 0.56, y + s * 0.74,
      x + s * 0.44, y + s * 0.62, x + s * 0.3, y + s * 0.74,
    ],
    INK,
  );
  // speed lines
  line(x + s * 0.1, y + s * 0.5, x + s * 0.26, y + s * 0.42, 2, GRAY);
  line(x + s * 0.08, y + s * 0.66, x + s * 0.24, y + s * 0.58, 2, GRAY);
  fillRect(x, y, s, 2, INK);
  fillRect(x, y + s - 2, s, 2, INK);
  fillRect(x, y, 2, s, INK);
  fillRect(x + s - 2, y, 2, s, INK);
}

// ------------------------------------------------------------------ layout ---
const M = 36; // side margin
const CW = W - 2 * M; // content width = 952

type Panel = { pic: (x: number, y: number, s: number) => void; head: string; body: string };

const PANELS: Panel[] = [
  {
    pic: picBridge,
    head: 'KERCH BRIDGE HIT AGAIN',
    body: 'UKRAINIAN DRONES AND MISSILES HIT THE CRIMEAN BRIDGE. IT WAS CLOSED AFTER SEVERE DAMAGE. RUSSIA HIT KYIV BRIDGES IN RETURN.',
  },
  {
    pic: picSummit,
    head: 'TRUMP, XI, PUTIN SET FOR SUMMIT',
    body: 'TRUMP ARRIVES IN SHENZHEN FOR APEC AND THE FIRST THREE-WAY SUMMIT WITH XI AND PUTIN. QUAD LEADERS SIGN MINERALS PACTS IN MANILA.',
  },
  {
    pic: picVirus,
    head: 'MEASLES STATUS LOST',
    body: 'THE UNITED STATES LOSES ITS MEASLES ELIMINATION STATUS, THE FIRST TIME SINCE 2000, HEALTH OFFICIALS CONFIRM.',
  },
  {
    pic: picBlackout,
    head: 'AMERICA GOES DARK',
    body: 'OUTAGES HIT US AIRPORTS, BANKS, MICROSOFT, APPLE AND AN NSA SYSTEM. AIR-TRAFFIC FAILURE GROUNDS FLIGHTS NATIONWIDE. OFFICIALS DENY A CYBER ATTACK.',
  },
  {
    pic: picTents,
    head: 'GAZA AID CALL',
    body: 'BRITAIN, AUSTRALIA, CANADA AND ITALY URGE ISRAEL TO OPEN CROSSINGS FOR AID AS WINTER RAINS FLOOD SHELTERS IN GAZA.',
  },
  {
    pic: picJets,
    head: 'JAPAN SCRAMBLES JETS',
    body: 'JAPAN LAUNCHES FIGHTER JETS AFTER SUSPECTED RUSSIAN AIRCRAFT VIOLATE ITS AIRSPACE.',
  },
];

type Brief = { title: string; body: string };
const BRIEFS: Brief[] = [
  { title: 'HOUTHIS ADVANCE', body: 'HOUTHI FORCES PUSH TOWARD ADEN FROM THE RED SEA COAST.' },
  { title: 'DEPARDIEU PLEADS GUILTY', body: 'THE ACTOR ADMITS SEXUAL ASSAULT IN A PARIS COURT.' },
  { title: 'NVIDIA SCANDAL', body: 'HUANG ACCUSED AS THE CHIPMAKER POSTS RECORD REVENUE.' },
  { title: 'PHUKET FIRE KILLS 11', body: 'FIRE SWEEPS A RESORT ON THE THAI ISLAND.' },
  { title: 'C-130 DESTROYED', body: 'ACTIVIST CHARGED OVER THE $60M PLANE WRECKED IN IRELAND.' },
];

const DECK =
  'US WARPLANES HIT A MISSILE SITE ON QESHM ISLAND AFTER IRANIAN ATTACKS ON BAHRAIN AND SHIPS IN THE STRAIT OF HORMUZ. ' +
  'TRUMP SAYS HE TAKES SERIOUSLY AN UNVERIFIED REPORT OF AN IRANIAN DIRTY BOMB PLOT IN WASHINGTON. IRAN DENIES IT.';

function rule(y: number, thick: number, c: RGB = INK): void {
  fillRect(M, y, CW, thick, c);
}

function drawPanel(p: Panel, px0: number, py: number, w: number): void {
  const picS = 116;
  p.pic(px0, py, picS);
  const tx = px0 + picS + 12;
  const tw = w - picS - 12;
  const headLines = wrapText(p.head, tw, 2.6);
  for (let i = 0; i < headLines.length; i++) {
    drawText(headLines[i], tx, py + 2 + i * 20, 2.6, INK);
  }
  drawPara(p.body, tx, py + 2 + headLines.length * 20 + 6, tw, 2.0, INK, 16);
}

function drawBrief(b: Brief, bx: number, by: number, bw: number): number {
  const titleLines = wrapText(b.title, bw, 1.8);
  let y = by;
  for (const l of titleLines) {
    drawText(l, bx, y, 1.8, RED);
    y += 17;
  }
  y += 3;
  const bodyLines = wrapText(b.body, bw, 1.8);
  for (const l of bodyLines) {
    drawText(l, bx, y, 1.8, INK);
    y += 17;
  }
  return y;
}

function main(): void {
  fillRect(0, 0, W, H, PAPER);

  // Masthead.
  fillRect(M, 20, CW, 2, INK);
  fillRect(M, 25, CW, 1, INK);
  drawText('THE WORLD TODAY', W / 2, 34, 7.5, INK, 'center');
  drawText('TUESDAY, 17 NOVEMBER 2026', W / 2, 92, 3, RED, 'center');
  rule(120, 2);

  // Top story.
  drawText('TOP STORY', W / 2, 130, 2, RED, 'center');
  drawText('U.S. STRIKES IRAN', W / 2, 148, 7, INK, 'center');
  const deckEnd = drawPara(DECK, M, 208, CW, 2.7, INK, 25);
  console.log('deck lines end at y=' + deckEnd);
  rule(340, 2);

  // Six panels: 2 columns x 3 rows.
  const rowH = 162;
  const colW = (CW - 32) / 2;
  const panelTop = 350;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 2; c++) {
      drawPanel(PANELS[r * 2 + c], M + c * (colW + 32), panelTop + r * rowH, colW);
    }
    if (r < 2) fillRect(M, panelTop + (r + 1) * rowH - 6, CW, 1, GRAY);
  }
  // Vertical divider between the two columns.
  fillRect(W / 2 - 1, panelTop, 1, 3 * rowH, GRAY);
  const panelsEnd = panelTop + 3 * rowH;
  console.log('panels end at y=' + panelsEnd);
  rule(panelsEnd + 8, 2);

  // Brief strip.
  const briefLabelY = panelsEnd + 18;
  drawText('IN BRIEF', M, briefLabelY, 2.2, RED);
  const briefTop = briefLabelY + 24;
  const bw = (CW - 4 * 16) / 5;
  let briefEnd = briefTop;
  for (let i = 0; i < BRIEFS.length; i++) {
    const bx = M + i * (bw + 16);
    const end = drawBrief(BRIEFS[i], bx, briefTop, bw);
    briefEnd = Math.max(briefEnd, end);
    if (i < BRIEFS.length - 1) fillRect(bx + bw + 7, briefTop, 1, end - briefTop, GRAY);
  }
  console.log('briefs end at y=' + briefEnd);

  // Footer.
  drawText('THE WORLD TODAY - TUESDAY, 17 NOVEMBER 2026', W / 2, briefEnd + 8, 1.6, GRAY, 'center');
  console.log('footer ends at y=' + (briefEnd + 8 + 12));

  const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
  mkdirSync(outDir, { recursive: true });
  const png = encodePNG();
  const file = join(outDir, 'entry.png');
  writeFileSync(file, png);
  const sha = createHash('sha256').update(png).digest('hex');
  console.log(`wrote ${file} ${png.length} bytes sha256=${sha}`);
}

main();

#!/usr/bin/env node
"use strict";

/**
 * Fail-closed checks for committed UX evidence PNGs.
 * Used by Stage 6b.3 capture (not npm test) and stage6b3-ui-polish-test.js.
 * Detects uniform/blank frames and oversized beyond-viewport dumps that
 * GitHub preview often renders as an empty dark rectangle.
 */

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) {
    return a;
  }
  if (pb <= pc) {
    return b;
  }
  return c;
}

function decodePngRgb(filePath) {
  const buf = fs.readFileSync(filePath);
  if (buf.length < 33 || buf[0] !== 0x89 || buf.toString("ascii", 1, 4) !== "PNG") {
    throw new Error(`${filePath} is not a PNG`);
  }
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  const bitDepth = buf[24];
  const colorType = buf[25];
  if (bitDepth !== 8 || (colorType !== 2 && colorType !== 6)) {
    throw new Error(`${path.basename(filePath)} unsupported PNG type colorType=${colorType} bitDepth=${bitDepth}`);
  }
  const bpp = colorType === 6 ? 4 : 3;
  const chunks = [];
  let offset = 8;
  while (offset + 12 <= buf.length) {
    const len = buf.readUInt32BE(offset);
    const type = buf.toString("ascii", offset + 4, offset + 8);
    if (type === "IDAT") {
      chunks.push(buf.subarray(offset + 8, offset + 8 + len));
    }
    if (type === "IEND") {
      break;
    }
    offset += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(chunks));
  const stride = width * bpp;
  const expected = height * (stride + 1);
  if (raw.length < expected) {
    throw new Error(`${path.basename(filePath)} PNG payload truncated (${raw.length} < ${expected})`);
  }
  const pixels = Buffer.alloc(height * stride);
  let src = 0;
  let prev = Buffer.alloc(stride);
  for (let y = 0; y < height; y += 1) {
    const filter = raw[src];
    src += 1;
    const row = raw.subarray(src, src + stride);
    src += stride;
    const out = pixels.subarray(y * stride, (y + 1) * stride);
    for (let i = 0; i < stride; i += 1) {
      const left = i >= bpp ? out[i - bpp] : 0;
      const up = prev[i];
      const upLeft = i >= bpp ? prev[i - bpp] : 0;
      let val = row[i];
      if (filter === 1) {
        val = (val + left) & 255;
      } else if (filter === 2) {
        val = (val + up) & 255;
      } else if (filter === 3) {
        val = (val + ((left + up) >> 1)) & 255;
      } else if (filter === 4) {
        val = (val + paeth(left, up, upLeft)) & 255;
      } else if (filter !== 0) {
        throw new Error(`${path.basename(filePath)} unsupported PNG filter ${filter}`);
      }
      out[i] = val;
    }
    prev = Buffer.from(out);
  }
  return { width, height, bpp, pixels, bytes: buf.length };
}

function analyzePng(filePath) {
  const { width, height, bpp, pixels, bytes } = decodePngRgb(filePath);
  const total = width * height;
  const buckets = new Map();
  let bright = 0;
  let dark = 0;
  const step = Math.max(1, Math.floor(total / 50000));
  let sampled = 0;
  for (let i = 0; i < total; i += step) {
    const offset = i * bpp;
    const r = pixels[offset];
    const g = pixels[offset + 1];
    const b = pixels[offset + 2];
    const luma = (r * 299 + g * 587 + b * 114) / 1000;
    if (luma > 80) {
      bright += 1;
    }
    if (luma < 40) {
      dark += 1;
    }
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    buckets.set(key, (buckets.get(key) || 0) + 1);
    sampled += 1;
  }
  let top = 0;
  for (const count of buckets.values()) {
    top = Math.max(top, count);
  }
  return {
    width,
    height,
    bytes,
    uniqueBuckets: buckets.size,
    dominantShare: top / sampled,
    brightShare: bright / sampled,
    darkShare: dark / sampled,
  };
}

function assertPngHasVisibleContent(filePath, options = {}) {
  const stats = analyzePng(filePath);
  const minWidth = options.minWidth || 300;
  const minHeight = options.minHeight || 300;
  const maxHeight = options.maxHeight || 1900;
  const maxWidth = options.maxWidth || 1600;
  const name = path.basename(filePath);
  if (stats.width < minWidth || stats.height < minHeight) {
    throw new Error(`${name} too small to review: ${stats.width}x${stats.height}`);
  }
  if (stats.width > maxWidth || stats.height > maxHeight) {
    throw new Error(
      `${name} exceeds review viewport (${stats.width}x${stats.height}); captureBeyondViewport dumps preview as a blank frame`
    );
  }
  if (stats.uniqueBuckets < 8) {
    throw new Error(`${name} looks uniform/blank (color buckets=${stats.uniqueBuckets})`);
  }
  if (stats.dominantShare > 0.97) {
    throw new Error(`${name} is effectively uniform (dominant share=${stats.dominantShare.toFixed(3)})`);
  }
  if (stats.brightShare < 0.008 && stats.uniqueBuckets < 16) {
    throw new Error(`${name} has almost no bright pixels (empty dark frame)`);
  }
  return stats;
}

module.exports = {
  analyzePng,
  assertPngHasVisibleContent,
  decodePngRgb,
};

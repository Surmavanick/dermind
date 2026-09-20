/**
 * Image-derived dermoscopic lesion analysis (runs in the browser, no model).
 *
 * Pipeline: skin/lesion separation (2-means on luminance + chromaticity),
 * morphological clean-up, largest component → lesion mask. From the mask:
 *  - contour overlay,
 *  - intra-lesion colour zones (dark pigment, pigment network, blue-white /
 *    regression, vascular / erythema),
 *  - attention heatmap (pigment density + colour variegation + redness),
 *  - ABCD-style metrics (asymmetry axes, abrupt border segments, colour count).
 *
 * Everything is heuristic and meant to support, not replace, the classifier.
 */

export interface LesionLayer {
  key: string;
  label: string;
  /** CSS colour used for the overlay and the legend swatch. */
  color: string;
  url: string;
  /** Share of the lesion area, in percent. */
  pct: number;
}

export interface LesionColour {
  key: string;
  label: string;
  swatch: string;
  pct: number;
}

export interface LesionMetrics {
  /** Lesion area as % of the frame. */
  areaPct: number;
  /** Equivalent-circle diameter as % of frame width. */
  diameterPct: number;
  /** Mean mirrored mismatch across the two principal axes, 0..1. */
  asymmetry: number;
  /** ABCD "A": number of principal axes with asymmetry (0–2). */
  asymmetryAxes: 0 | 1 | 2;
  /** ABCD "B": number of 45° segments with an abrupt pigment cut-off (0–8). */
  borderSegments: number;
  /** Compactness ratio; 1 ≈ circle, higher = more irregular outline. */
  borderIrregularity: number;
  /** ABCD "C": dermoscopic colours present. */
  colours: LesionColour[];
  /** Colour variegation index, 0..1. */
  variegation: number;
}

export interface LesionAnalysis {
  width: number;
  height: number;
  /** Lesion outline (PNG data URL, transparent background). */
  contour: string;
  /** Attention heatmap (PNG data URL, transparent where irrelevant). */
  heatmap: string;
  layers: LesionLayer[];
  metrics: LesionMetrics;
}

export interface LesionInput {
  /** Primary (non-polarized) channel. */
  base: string;
  /** Polarized channel, used for the vascular / erythema signal when available. */
  polarized?: string | null;
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const loadImage = (src: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

const readPixels = (img: HTMLImageElement, w: number, h: number): Uint8ClampedArray | null => {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h).data;
};

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Separable box blur on a float field. */
const boxBlur = (src: Float32Array, w: number, h: number, r: number) => {
  if (r <= 0) return src;
  const tmp = new Float32Array(src.length);
  const dst = new Float32Array(src.length);
  const span = 2 * r + 1;
  for (let y = 0; y < h; y += 1) {
    let sum = 0;
    for (let x = -r; x <= r; x += 1) sum += src[y * w + clamp(x, 0, w - 1)];
    for (let x = 0; x < w; x += 1) {
      tmp[y * w + x] = sum / span;
      sum += src[y * w + clamp(x + r + 1, 0, w - 1)] - src[y * w + clamp(x - r, 0, w - 1)];
    }
  }
  for (let x = 0; x < w; x += 1) {
    let sum = 0;
    for (let y = -r; y <= r; y += 1) sum += tmp[clamp(y, 0, h - 1) * w + x];
    for (let y = 0; y < h; y += 1) {
      dst[y * w + x] = sum / span;
      sum += tmp[clamp(y + r + 1, 0, h - 1) * w + x] - tmp[clamp(y - r, 0, h - 1) * w + x];
    }
  }
  return dst;
};

const smooth = (src: Float32Array, w: number, h: number, r: number) => boxBlur(boxBlur(boxBlur(src, w, h, r), w, h, r), w, h, r);

const dilate = (mask: Uint8Array, w: number, h: number, r: number) => {
  const tmp = new Uint8Array(mask.length);
  const dst = new Uint8Array(mask.length);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let v = 0;
      for (let k = -r; k <= r && !v; k += 1) {
        const nx = x + k;
        if (nx >= 0 && nx < w && mask[y * w + nx]) v = 1;
      }
      tmp[y * w + x] = v;
    }
  }
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let v = 0;
      for (let k = -r; k <= r && !v; k += 1) {
        const ny = y + k;
        if (ny >= 0 && ny < h && tmp[ny * w + x]) v = 1;
      }
      dst[y * w + x] = v;
    }
  }
  return dst;
};

const erode = (mask: Uint8Array, w: number, h: number, r: number) => {
  const inv = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i += 1) inv[i] = mask[i] ? 0 : 1;
  const d = dilate(inv, w, h, r);
  for (let i = 0; i < d.length; i += 1) d[i] = d[i] ? 0 : 1;
  return d;
};

const largestComponent = (mask: Uint8Array, w: number, h: number) => {
  const visited = new Uint8Array(mask.length);
  let best: number[] = [];
  const stack: number[] = [];
  for (let s = 0; s < mask.length; s += 1) {
    if (!mask[s] || visited[s]) continue;
    const comp: number[] = [];
    stack.push(s);
    visited[s] = 1;
    while (stack.length) {
      const cur = stack.pop() as number;
      comp.push(cur);
      const x = cur % w;
      const y = (cur - x) / w;
      const nb = [x > 0 ? cur - 1 : -1, x < w - 1 ? cur + 1 : -1, y > 0 ? cur - w : -1, y < h - 1 ? cur + w : -1];
      for (let k = 0; k < 4; k += 1) {
        const n = nb[k];
        if (n >= 0 && mask[n] && !visited[n]) {
          visited[n] = 1;
          stack.push(n);
        }
      }
    }
    if (comp.length > best.length) best = comp;
  }
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < best.length; i += 1) out[best[i]] = 1;
  return out;
};

const fillHoles = (mask: Uint8Array, w: number, h: number) => {
  const reach = new Uint8Array(mask.length);
  const stack: number[] = [];
  const push = (i: number) => {
    if (!mask[i] && !reach[i]) {
      reach[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x += 1) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y += 1) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (stack.length) {
    const cur = stack.pop() as number;
    const x = cur % w;
    const y = (cur - x) / w;
    if (x > 0) push(cur - 1);
    if (x < w - 1) push(cur + 1);
    if (y > 0) push(cur - w);
    if (y < h - 1) push(cur + w);
  }
  const out = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i += 1) out[i] = mask[i] || !reach[i] ? 1 : 0;
  return out;
};

const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const rgbaToDataUrl = (rgba: Uint8ClampedArray, w: number, h: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  ctx.putImageData(new ImageData(rgba, w, h), 0, 0);
  return canvas.toDataURL("image/png");
};

const alphaLayer = (alpha: Float32Array, w: number, h: number, hex: string) => {
  const [r, g, b] = hexToRgb(hex);
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i += 1) {
    out[i * 4] = r;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = b;
    out[i * 4 + 3] = clamp(Math.round(alpha[i]), 0, 255);
  }
  return rgbaToDataUrl(out, w, h);
};

/* ------------------------------------------------------------------ */
/* colour zones                                                        */
/* ------------------------------------------------------------------ */

const ZONE_DEFS = [
  { key: "dark", label: "Dark pigment", color: "#e11d48" },
  { key: "network", label: "Pigment network", color: "#f59e0b" },
  { key: "bluewhite", label: "Blue-white / regression", color: "#38bdf8" },
  { key: "vascular", label: "Vascular / erythema", color: "#22c55e" },
] as const;

const COLOUR_DEFS = [
  { key: "black", label: "Black", swatch: "#111111" },
  { key: "darkbrown", label: "Dark brown", swatch: "#5b3a1e" },
  { key: "lightbrown", label: "Light brown", swatch: "#b8834f" },
  { key: "red", label: "Red", swatch: "#d3423e" },
  { key: "bluegray", label: "Blue-gray", swatch: "#6b7f99" },
  { key: "white", label: "White", swatch: "#f1efe9" },
] as const;

/** Heat colour ramp: transparent → sky → lime → yellow → red. */
const heatColour = (v: number): [number, number, number, number] => {
  const stops: [number, [number, number, number]][] = [
    [0.0, [56, 189, 248]],
    [0.35, [163, 230, 53]],
    [0.65, [250, 204, 21]],
    [1.0, [239, 68, 68]],
  ];
  let i = 0;
  while (i < stops.length - 2 && v > stops[i + 1][0]) i += 1;
  const [t0, c0] = stops[i];
  const [t1, c1] = stops[i + 1];
  const t = clamp((v - t0) / (t1 - t0), 0, 1);
  const alpha = Math.round(clamp(Math.pow(v, 1.15), 0, 1) * 215);
  return [Math.round(c0[0] + (c1[0] - c0[0]) * t), Math.round(c0[1] + (c1[1] - c0[1]) * t), Math.round(c0[2] + (c1[2] - c0[2]) * t), alpha];
};

/* ------------------------------------------------------------------ */
/* main                                                                */
/* ------------------------------------------------------------------ */

export const analyzeLesion = async (input: LesionInput, maxW = 420): Promise<LesionAnalysis | null> => {
  const baseImg = await loadImage(input.base);
  if (!baseImg || !baseImg.width) return null;
  const scale = Math.min(1, maxW / baseImg.width);
  const w = Math.max(96, Math.round(baseImg.width * scale));
  const h = Math.max(72, Math.round(baseImg.height * scale));
  const px = readPixels(baseImg, w, h);
  if (!px) return null;
  const polImg = input.polarized ? await loadImage(input.polarized) : null;
  const ppx = polImg ? readPixels(polImg, w, h) : null;

  const n = w * h;
  const L = new Float32Array(n);
  const A = new Float32Array(n); // redness  (R - G)
  const B = new Float32Array(n); // yellowness ((R+G)/2 - B)
  const C = new Float32Array(n); // chroma
  const HUE = new Float32Array(n); // hue (deg) from the base channel
  const SAT = new Float32Array(n); // saturation 0..1 from the base channel
  const HUEP = new Float32Array(n); // hue / saturation from the polarized channel (vascular signal)
  const SATP = new Float32Array(n);
  const hueOf = (r: number, g: number, b: number) => {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    if (d === 0) return 0;
    let hh: number;
    if (max === r) hh = ((g - b) / d) % 6;
    else if (max === g) hh = (b - r) / d + 2;
    else hh = (r - g) / d + 4;
    hh *= 60;
    return hh < 0 ? hh + 360 : hh;
  };
  const satOf = (r: number, g: number, b: number) => {
    const max = Math.max(r, g, b);
    return max === 0 ? 0 : (max - Math.min(r, g, b)) / max;
  };
  for (let i = 0; i < n; i += 1) {
    const r = px[i * 4];
    const g = px[i * 4 + 1];
    const b = px[i * 4 + 2];
    L[i] = 0.299 * r + 0.587 * g + 0.114 * b;
    A[i] = r - g;
    B[i] = (r + g) / 2 - b;
    C[i] = Math.max(r, g, b) - Math.min(r, g, b);
    HUE[i] = hueOf(r, g, b);
    SAT[i] = satOf(r, g, b);
    if (ppx) {
      HUEP[i] = hueOf(ppx[i * 4], ppx[i * 4 + 1], ppx[i * 4 + 2]);
      SATP[i] = satOf(ppx[i * 4], ppx[i * 4 + 1], ppx[i * 4 + 2]);
    } else {
      HUEP[i] = HUE[i];
      SATP[i] = SAT[i];
    }
  }
  /** True red / pink hues (vascular, erythema) as opposed to brown / orange pigment. */
  const isRedHue = (hue: number) => hue <= 12 || hue >= 338;

  /* --- skin reference: a ring inset from the frame edge (less vignette) --- */
  const inset = (f: number) => ({ x0: Math.round(w * f), x1: Math.round(w * (1 - f)), y0: Math.round(h * f), y1: Math.round(h * (1 - f)) });
  const outer = inset(0.04);
  const inner = inset(0.11);
  let rl = 0;
  let ra = 0;
  let rb = 0;
  let rc = 0;
  for (let y = outer.y0; y < outer.y1; y += 1) {
    for (let x = outer.x0; x < outer.x1; x += 1) {
      if (x >= inner.x0 && x < inner.x1 && y >= inner.y0 && y < inner.y1) continue;
      const i = y * w + x;
      rl += L[i];
      ra += A[i];
      rb += B[i];
      rc += 1;
    }
  }
  const ring = { L: rl / Math.max(1, rc), A: ra / Math.max(1, rc), B: rb / Math.max(1, rc) };

  /* --- flatten slow illumination gradients (shading) before clustering --- */
  let meanL = 0;
  for (let i = 0; i < n; i += 1) meanL += L[i];
  meanL /= n;
  const Lbg = boxBlur(L, w, h, Math.round(w / 4));
  const Lf = new Float32Array(n);
  for (let i = 0; i < n; i += 1) Lf[i] = L[i] - 0.75 * (Lbg[i] - meanL);

  /* --- 3-means on (flattened L, a, b): typically skin / intermediate / lesion --- */
  const feat = (i: number): [number, number, number] => [(Lf[i] / 255) * 0.8, (A[i] / 255) * 2.0, (B[i] / 255) * 2.0];
  const K = 3;
  const order = Array.from({ length: n }, (_, i) => i).sort((p, q) => Lf[p] - Lf[q]);
  const seedGroups = [order.slice(0, Math.max(1, Math.floor(n * 0.05))), order.slice(Math.floor(n * 0.4), Math.floor(n * 0.6)), order.slice(Math.floor(n * 0.7))];
  let cents = seedGroups.map((group) => {
    const acc = [0, 0, 0];
    group.forEach((i) => {
      const f = feat(i);
      acc[0] += f[0];
      acc[1] += f[1];
      acc[2] += f[2];
    });
    return acc.map((v) => v / Math.max(1, group.length));
  });
  const label = new Uint8Array(n);
  const sq = (p: number[], q: number[]) => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
  for (let iter = 0; iter < 12; iter += 1) {
    const sums = cents.map(() => [0, 0, 0]);
    const counts = [0, 0, 0];
    for (let i = 0; i < n; i += 1) {
      const f = feat(i);
      let best = 0;
      let bestD = Infinity;
      for (let k = 0; k < K; k += 1) {
        const d = sq(f, cents[k]);
        if (d < bestD) {
          bestD = d;
          best = k;
        }
      }
      label[i] = best;
      sums[best][0] += f[0];
      sums[best][1] += f[1];
      sums[best][2] += f[2];
      counts[best] += 1;
    }
    cents = cents.map((c, k) => (counts[k] ? sums[k].map((v) => v / counts[k]) : c));
  }

  /* --- which clusters are lesion? --- */
  const area3 = [0, 0, 0];
  const ring3 = [0, 0, 0];
  let ringTotal = 0;
  const edge = inset(0.02);
  for (let i = 0; i < n; i += 1) {
    area3[label[i]] += 1;
    const x = i % w;
    const y = (i - x) / w;
    if (x < edge.x0 || x >= edge.x1 || y < edge.y0 || y >= edge.y1) {
      ringTotal += 1;
      ring3[label[i]] += 1;
    }
  }
  const ringShare = ring3.map((v) => v / Math.max(1, ringTotal));
  const bright = [0, 1, 2].reduce((best, k) => (cents[k][0] > cents[best][0] ? k : best), 0);
  const lesionSet = new Set<number>();
  if (area3[bright] / n < 0.2 && ringShare[bright] > 0.1) {
    // Close-up: the lesion fills the frame and only a sliver of skin shows at the edge.
    [0, 1, 2].forEach((k) => {
      if (k !== bright) lesionSet.add(k);
    });
  } else {
    // Surrounding skin owns most of the frame border; the lesion seed is the cluster with the
    // least border contact (ties: farther from skin). The third cluster joins the lesion only if
    // its colour is closer to the seed than to the skin.
    const skin = [0, 1, 2].reduce((best, k) => (ringShare[k] > ringShare[best] ? k : best), 0);
    const others = [0, 1, 2].filter((k) => k !== skin).sort((p, q) => ringShare[p] - ringShare[q] || sq(cents[q], cents[skin]) - sq(cents[p], cents[skin]));
    const seed = others[0];
    const rest = others[1];
    lesionSet.add(seed);
    if (sq(cents[rest], cents[seed]) < sq(cents[rest], cents[skin])) lesionSet.add(rest);
  }

  let mask = new Uint8Array(n);
  const margin = inset(0.03);
  for (let y = margin.y0; y < margin.y1; y += 1) {
    for (let x = margin.x0; x < margin.x1; x += 1) {
      const i = y * w + x;
      mask[i] = lesionSet.has(label[i]) ? 1 : 0;
    }
  }
  const cleanUp = (m: Uint8Array) => largestComponent(fillHoles(erode(dilate(dilate(erode(m, w, h, 2), w, h, 2), w, h, 3), w, h, 3), w, h), w, h);
  mask = cleanUp(mask);
  let area = mask.reduce((s, v) => s + v, 0);

  // Ring-like masks (an erythematous rim around a pale centre, a pearly nodule with a bright
  // core): close with a large element and keep the filled interior when it clearly adds area.
  if (area > 0) {
    const rBig = Math.max(6, Math.round(w * 0.045));
    const filled = largestComponent(erode(fillHoles(dilate(mask, w, h, rBig), w, h), w, h, rBig), w, h);
    const filledArea = filled.reduce((s, v) => s + v, 0);
    if (filledArea > area * 1.5 && filledArea < n * 0.9) {
      mask = filled;
      area = filledArea;
    }
  }

  if (area < n * 0.012 || area > n * 0.9) {
    // Fallback: anything clearly darker or more saturated than the skin reference.
    const fb = new Uint8Array(n);
    for (let y = margin.y0; y < margin.y1; y += 1) {
      for (let x = margin.x0; x < margin.x1; x += 1) {
        const i = y * w + x;
        fb[i] = L[i] < ring.L - 28 || A[i] > ring.A + 22 ? 1 : 0;
      }
    }
    mask = cleanUp(fb);
    area = mask.reduce((s, v) => s + v, 0);
    if (area < n * 0.012) return null;
  }

  /* --- boundary, centroid, principal axes --- */
  const boundary: number[] = [];
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i += 1) {
    if (!mask[i]) continue;
    const x = i % w;
    const y = (i - x) / w;
    cx += x;
    cy += y;
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1 || !mask[i - 1] || !mask[i + 1] || !mask[i - w] || !mask[i + w]) boundary.push(i);
  }
  cx /= area;
  cy /= area;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  for (let i = 0; i < n; i += 1) {
    if (!mask[i]) continue;
    const dx = (i % w) - cx;
    const dy = Math.floor(i / w) - cy;
    sxx += dx * dx;
    syy += dy * dy;
    sxy += dx * dy;
  }
  const theta = 0.5 * Math.atan2(2 * sxy, sxx - syy);
  const axes: [number, number][] = [
    [Math.cos(theta), Math.sin(theta)],
    [-Math.sin(theta), Math.cos(theta)],
  ];
  const mismatch = axes.map(([ux, uy]) => {
    let miss = 0;
    for (let i = 0; i < n; i += 1) {
      if (!mask[i]) continue;
      const dx = (i % w) - cx;
      const dy = Math.floor(i / w) - cy;
      const d = dx * ux + dy * uy;
      const rx = Math.round(2 * d * ux - dx + cx);
      const ry = Math.round(2 * d * uy - dy + cy);
      if (rx < 0 || ry < 0 || rx >= w || ry >= h || !mask[ry * w + rx]) miss += 1;
    }
    return miss / area;
  });
  const asymmetry = (mismatch[0] + mismatch[1]) / 2;
  const asymmetryAxes = mismatch.filter((m) => m > 0.1).length as 0 | 1 | 2;

  /* --- border abruptness per 45° segment --- */
  const Ls = smooth(L, w, h, 1);
  const segSum = new Float32Array(8);
  const segCnt = new Float32Array(8);
  boundary.forEach((i) => {
    const x = i % w;
    const y = (i - x) / w;
    const dx = x - cx;
    const dy = y - cy;
    const len = Math.hypot(dx, dy) || 1;
    const nx = dx / len;
    const ny = dy / len;
    const xi = clamp(Math.round(x - nx * 3), 0, w - 1);
    const yi = clamp(Math.round(y - ny * 3), 0, h - 1);
    const xo = clamp(Math.round(x + nx * 3), 0, w - 1);
    const yo = clamp(Math.round(y + ny * 3), 0, h - 1);
    const grad = Math.abs(Ls[yi * w + xi] - Ls[yo * w + xo]);
    const seg = Math.floor((((Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI)) * 8) % 8);
    segSum[seg] += grad;
    segCnt[seg] += 1;
  });
  let borderSegments = 0;
  for (let s = 0; s < 8; s += 1) if (segCnt[s] > 3 && segSum[s] / segCnt[s] > 26) borderSegments += 1;
  const perimeter = boundary.length;
  const borderIrregularity = (perimeter * perimeter) / (4 * Math.PI * area) / 1.25;

  /* --- lesion statistics --- */
  const lesionL: number[] = [];
  for (let i = 0; i < n; i += 1) if (mask[i]) lesionL.push(L[i]);
  lesionL.sort((p, q) => p - q);
  const q = (f: number) => lesionL[Math.min(lesionL.length - 1, Math.floor(lesionL.length * f))];
  const p30 = q(0.3);

  /* --- colour zones + dermoscopic colours --- */
  const zoneAlpha: Record<string, Float32Array> = {};
  ZONE_DEFS.forEach((z) => {
    zoneAlpha[z.key] = new Float32Array(n);
  });
  const zoneCount: Record<string, number> = { dark: 0, network: 0, bluewhite: 0, vascular: 0 };
  const colourCount: Record<string, number> = {};
  COLOUR_DEFS.forEach((c) => {
    colourCount[c.key] = 0;
  });
  for (let i = 0; i < n; i += 1) {
    if (!mask[i]) continue;
    const l = L[i];
    const b = B[i];
    const c = C[i];
    let zone: string;
    if (isRedHue(HUEP[i]) && SATP[i] > 0.3 && l > 75) zone = "vascular";
    else if ((b < -4 && c > 10 && l > 55 && l < 175) || (l > 150 && c < 30)) zone = "bluewhite";
    else if (l < Math.min(p30, 95)) zone = "dark";
    else zone = "network";
    zoneAlpha[zone][i] = 255;
    zoneCount[zone] += 1;

    if (l < 48) colourCount.black += 1;
    else if (b < -4 && c > 10 && l < 175) colourCount.bluegray += 1;
    else if (l > 190 && c < 30) colourCount.white += 1;
    else if (isRedHue(HUE[i]) && SAT[i] > 0.35 && l > 70) colourCount.red += 1;
    else if (l < 125) colourCount.darkbrown += 1;
    else colourCount.lightbrown += 1;
  }
  const layers: LesionLayer[] = ZONE_DEFS.map((z) => ({
    key: z.key,
    label: z.label,
    color: z.color,
    url: alphaLayer(boxBlur(zoneAlpha[z.key], w, h, 1), w, h, z.color),
    pct: Math.round((zoneCount[z.key] / area) * 100),
  }));
  const colours: LesionColour[] = COLOUR_DEFS.map((c) => ({ key: c.key, label: c.label, swatch: c.swatch, pct: Math.round((colourCount[c.key] / area) * 1000) / 10 })).filter(
    (c) => c.pct >= 3
  );

  /* --- attention heatmap: pigment density + local colour variance + redness --- */
  const dark = new Float32Array(n);
  const red = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    dark[i] = clamp((ring.L - L[i]) / 140, 0, 1);
    red[i] = isRedHue(HUEP[i]) ? clamp((SATP[i] - 0.25) / 0.4, 0, 1) : 0;
  }
  const Lm = boxBlur(L, w, h, 3);
  const L2 = new Float32Array(n);
  for (let i = 0; i < n; i += 1) L2[i] = L[i] * L[i];
  const L2m = boxBlur(L2, w, h, 3);
  const variance = new Float32Array(n);
  for (let i = 0; i < n; i += 1) variance[i] = clamp(Math.sqrt(Math.max(0, L2m[i] - Lm[i] * Lm[i])) / 45, 0, 1);
  const region = dilate(mask, w, h, 6);
  const scoreRaw = new Float32Array(n);
  for (let i = 0; i < n; i += 1) scoreRaw[i] = region[i] ? 0.5 * dark[i] + 0.3 * variance[i] + 0.35 * red[i] : 0;
  const score = smooth(scoreRaw, w, h, 4);
  let maxScore = 0;
  for (let i = 0; i < n; i += 1) if (score[i] > maxScore) maxScore = score[i];
  const heat = new Uint8ClampedArray(n * 4);
  let varSum = 0;
  for (let i = 0; i < n; i += 1) {
    const v = maxScore > 0 ? score[i] / maxScore : 0;
    if (mask[i]) varSum += variance[i];
    if (v < 0.08) continue;
    const [r, g, b, a] = heatColour(v);
    heat[i * 4] = r;
    heat[i * 4 + 1] = g;
    heat[i * 4 + 2] = b;
    heat[i * 4 + 3] = a;
  }

  /* --- contour overlay --- */
  const bnd = new Uint8Array(n);
  boundary.forEach((i) => {
    bnd[i] = 1;
  });
  const line = dilate(bnd, w, h, 1);
  const halo = dilate(bnd, w, h, 2);
  const contour = new Uint8ClampedArray(n * 4);
  for (let i = 0; i < n; i += 1) {
    if (line[i]) {
      contour[i * 4] = 34;
      contour[i * 4 + 1] = 211;
      contour[i * 4 + 2] = 238;
      contour[i * 4 + 3] = 235;
    } else if (halo[i]) {
      contour[i * 4] = 8;
      contour[i * 4 + 1] = 47;
      contour[i * 4 + 2] = 73;
      contour[i * 4 + 3] = 150;
    } else if (mask[i]) {
      contour[i * 4] = 34;
      contour[i * 4 + 1] = 211;
      contour[i * 4 + 2] = 238;
      contour[i * 4 + 3] = 22;
    }
  }

  const diameterPct = (2 * Math.sqrt(area / Math.PI) / w) * 100;
  return {
    width: w,
    height: h,
    contour: rgbaToDataUrl(contour, w, h),
    heatmap: rgbaToDataUrl(heat, w, h),
    layers,
    metrics: {
      areaPct: Math.round((area / n) * 1000) / 10,
      diameterPct: Math.round(diameterPct * 10) / 10,
      asymmetry: Math.round(asymmetry * 100) / 100,
      asymmetryAxes,
      borderSegments,
      borderIrregularity: Math.round(borderIrregularity * 100) / 100,
      colours,
      variegation: Math.round(clamp(varSum / area, 0, 1) * 100) / 100,
    },
  };
};

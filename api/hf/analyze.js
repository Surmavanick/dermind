export const config = { maxDuration: 60, api: { bodyParser: false } };

const HF_SPACE_URL = "https://mstepien-dermatolog-ai-scan.hf.space";
const HF_MODEL = "medsiglip";

// Three-spectrum capture. Every channel is uploaded and analysed on its own,
// then the per-channel probability vectors are fused into one combined ranking.
const CHANNELS = [
  { id: 1, field: "channel_1", name: "Non-polarized", detects: "Surface texture, scales, milia" },
  { id: 2, field: "channel_2", name: "Polarized", detects: "Vascular network, melanin depth, shiny white structures" },
  { id: 3, field: "channel_3", name: "UV / Blue Light", detects: "Fluorescence: fungi, bacteria, porphyrins" },
];

// Relative weight of each spectrum in the fused score. Equal by default.
const CHANNEL_WEIGHTS = { 0: 1, 1: 1, 2: 1, 3: 1 };

// Single-image mode: the client fuses the three spectral layers into one digital map
// and sends only that (one model call instead of three).
const FUSED = { id: 0, field: "fused", name: "Unified digital map", detects: "Non-polarized, polarized and UV / blue-light layers fused" };

/** Minimal multipart/form-data parser (no dependencies). Returns [{ name, filename, type, data }]. */
function parseMultipart(body, contentType) {
  const match = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType || "");
  if (!match) return [];
  const boundary = Buffer.from(`--${(match[1] || match[2]).trim()}`);
  const parts = [];
  let cursor = body.indexOf(boundary);

  while (cursor !== -1) {
    cursor += boundary.length;
    if (body[cursor] === 0x2d && body[cursor + 1] === 0x2d) break; // closing "--"
    if (body[cursor] === 0x0d && body[cursor + 1] === 0x0a) cursor += 2;

    const next = body.indexOf(boundary, cursor);
    if (next === -1) break;
    let end = next;
    if (body[end - 2] === 0x0d && body[end - 1] === 0x0a) end -= 2;

    const headerEnd = body.indexOf("\r\n\r\n", cursor);
    if (headerEnd !== -1 && headerEnd < end) {
      const headers = {};
      body
        .subarray(cursor, headerEnd)
        .toString("utf8")
        .split("\r\n")
        .forEach((line) => {
          const idx = line.indexOf(":");
          if (idx > 0) headers[line.slice(0, idx).trim().toLowerCase()] = line.slice(idx + 1).trim();
        });
      const disposition = headers["content-disposition"] || "";
      const name = /name="([^"]*)"/.exec(disposition)?.[1] ?? "";
      const filename = /filename="([^"]*)"/.exec(disposition)?.[1];
      parts.push({
        name,
        filename,
        type: headers["content-type"] || "application/octet-stream",
        data: body.subarray(headerEnd + 4, end),
      });
    }
    cursor = next;
  }
  return parts;
}

function normalisePredictions(list) {
  if (!Array.isArray(list)) return [];
  return list
    .map((p) => ({
      label: String(p?.label ?? p?.class ?? p?.name ?? ""),
      score: Number(p?.score ?? p?.confidence ?? p?.probability ?? 0),
    }))
    .filter((p) => p.label && Number.isFinite(p.score))
    .sort((a, b) => b.score - a.score);
}

async function uploadAndAnalyze(part, cookie) {
  const form = new FormData();
  form.append("files", new Blob([part.data], { type: part.type }), part.filename || "channel.jpg");

  const uploadResp = await fetch(`${HF_SPACE_URL}/api/photos/upload`, {
    method: "POST",
    headers: cookie ? { cookie } : {},
    body: form,
  });
  if (!uploadResp.ok) {
    const text = await uploadResp.text();
    throw new Error(`Upload failed (HTTP ${uploadResp.status}): ${text.slice(0, 200)}`);
  }
  const uploadJson = await uploadResp.json();
  const id = (uploadJson.ids || [])[0];
  if (!id) throw new Error("No photo id returned");

  const analyzeResp = await fetch(`${HF_SPACE_URL}/api/photos/${id}/analyze`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify({ model: HF_MODEL }),
  });
  if (!analyzeResp.ok) {
    const text = await analyzeResp.text();
    throw new Error(`Analyze failed (HTTP ${analyzeResp.status}): ${text.slice(0, 200)}`);
  }
  const raw = await analyzeResp.json();
  const predictions = normalisePredictions(raw.predictions || raw.results || raw.labels || []);
  return { predictions, raw };
}

/** Weighted mean of per-channel probabilities. A label missing from a channel counts as 0 there. */
function fusePredictions(channels) {
  const used = channels.filter((c) => c.predictions.length);
  const totalWeight = used.reduce((sum, c) => sum + (CHANNEL_WEIGHTS[c.id] ?? 1), 0);
  if (!totalWeight) return [];
  const acc = new Map();
  used.forEach((c) => {
    const w = CHANNEL_WEIGHTS[c.id] ?? 1;
    c.predictions.forEach((p) => acc.set(p.label, (acc.get(p.label) || 0) + w * p.score));
  });
  return [...acc.entries()]
    .map(([label, sum]) => ({ label, score: sum / totalWeight }))
    .sort((a, b) => b.score - a.score);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, detail: "Method not allowed" });
  }

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks);
    const parts = parseMultipart(rawBody, req.headers["content-type"] || "");
    const files = parts.filter((p) => p.filename !== undefined && p.data.length > 0);

    // Map uploaded parts onto spectral channels. A "fused" part is evaluated alone;
    // legacy single "file" field → channel 1.
    const fusedPart = files.find((f) => f.name === FUSED.field);
    const selected = fusedPart
      ? [{ ...FUSED, part: fusedPart }]
      : CHANNELS.map((ch) => {
          const part =
            files.find((f) => f.name === ch.field) ||
            (ch.id === 1 ? files.find((f) => f.name === "file" || f.name === "files") : undefined);
          return part ? { ...ch, part } : null;
        }).filter(Boolean);

    if (!selected.length) {
      return res.status(400).json({
        success: false,
        detail: "No image received. Send a fused image field, or channel_1, channel_2 and channel_3.",
      });
    }

    // Session cookie for the HF Space, shared by all channel requests.
    const initResp = await fetch(`${HF_SPACE_URL}/`, { redirect: "follow" });
    const cookie = (initResp.headers.get("set-cookie") || "").split(";")[0] || "";

    // One model call per scan: the model is single-image, so only the primary channel
    // (non-polarized, or the first one received) is evaluated. The other channels mirror
    // that evaluation and are flagged `derived_from` so the UI keeps its combined view.
    const primary = selected.find((ch) => ch.id === 1) || selected[0];
    let primaryResult;
    try {
      const { predictions, raw } = await uploadAndAnalyze(primary.part, cookie);
      primaryResult = { predictions, top_prediction: predictions[0] || null, raw };
    } catch (err) {
      primaryResult = { predictions: [], top_prediction: null, error: String(err?.message || err) };
    }
    const channels = selected.map((ch) => {
      const base = { id: ch.id, name: ch.name, detects: ch.detects, filename: ch.part.filename };
      if (ch === primary) return { ...base, ...primaryResult };
      return {
        ...base,
        predictions: primaryResult.predictions,
        top_prediction: primaryResult.top_prediction,
        derived_from: primary.id,
        ...(primaryResult.error ? { error: primaryResult.error } : {}),
      };
    });

    const predictions = fusePredictions(channels.filter((c) => c.id === primary.id));
    if (!predictions.length) {
      return res.status(502).json({
        success: false,
        detail: channels.map((c) => `${c.name}: ${c.error || "no predictions"}`).join(" | "),
        channels: channels.map(({ raw, ...c }) => c),
      });
    }

    return res.status(200).json({
      success: true,
      top_prediction: predictions[0],
      predictions,
      fusion: {
        method: "single-image",
        evaluated_channel: primary.id,
        weights: CHANNEL_WEIGHTS,
        channels_used: channels.filter((c) => c.predictions.length).map((c) => c.id),
        channels_total: CHANNELS.length,
      },
      channels: channels.map(({ raw, ...c }) => c),
      _raw: Object.fromEntries(channels.map((c) => [`channel_${c.id}`, c.raw ?? null])),
    });
  } catch (err) {
    return res.status(500).json({ success: false, detail: String(err) });
  }
}

import { Readable } from "stream";

const HF_SPACE_URL = "https://mstepien-dermatolog-ai-scan.hf.space";

export const config = { api: { bodyParser: false } };

async function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    // Step 1: get session cookie from HF Space root
    const initResp = await fetch(`${HF_SPACE_URL}/`, { redirect: "follow" });
    const setCookie = initResp.headers.get("set-cookie") || "";
    const cookie = setCookie.split(";")[0];

    // Step 2: forward the multipart body to HF Space upload
    const rawBody = await readBody(req);
    const contentType = req.headers["content-type"] || "";

    const uploadResp = await fetch(`${HF_SPACE_URL}/api/photos/upload`, {
      method: "POST",
      headers: {
        "content-type": contentType,
        ...(cookie ? { cookie } : {}),
      },
      body: rawBody,
    });

    if (!uploadResp.ok) {
      const text = await uploadResp.text();
      res.status(502).json({ success: false, detail: `Upload failed: ${text.slice(0, 300)}` });
      return;
    }

    const uploadJson = await uploadResp.json();
    const ids = uploadJson.ids || [];
    if (!ids.length) {
      res.status(502).json({ success: false, detail: "No photo id returned from upload" });
      return;
    }

    const photoId = ids[0];

    // Step 3: analyze
    const analyzeResp = await fetch(`${HF_SPACE_URL}/api/photos/${photoId}/analyze`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify({ model: "medsiglip" }),
    });

    if (!analyzeResp.ok) {
      const text = await analyzeResp.text();
      res.status(502).json({ success: false, detail: `Analyze failed: ${text.slice(0, 300)}` });
      return;
    }

    const analysisJson = await analyzeResp.json();
    const predictions = analysisJson.predictions || [];

    res.status(200).json({
      success: true,
      top_prediction: predictions[0] || null,
      predictions,
    });
  } catch (err) {
    res.status(500).json({ success: false, detail: String(err) });
  }
}

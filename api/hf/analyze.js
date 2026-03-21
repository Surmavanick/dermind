export const config = { maxDuration: 60 };

const HF_SPACE_URL = "https://mstepien-dermatolog-ai-scan.hf.space";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, detail: "Method not allowed" });
  }

  try {
    // Step 1: get session cookie
    const initResp = await fetch(`${HF_SPACE_URL}/`, { redirect: "follow" });
    const setCookie = initResp.headers.get("set-cookie") || "";
    const cookie = setCookie.split(";")[0] || "";

    // Step 2: read raw body and forward as multipart with field name "files"
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const rawBody = Buffer.concat(chunks);
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
      return res.status(502).json({ success: false, detail: `Upload failed: ${text.slice(0, 300)}` });
    }

    const uploadJson = await uploadResp.json();
    const ids = uploadJson.ids || [];
    if (!ids.length) {
      return res.status(502).json({ success: false, detail: "No photo id returned" });
    }

    // Step 3: analyze
    const analyzeResp = await fetch(`${HF_SPACE_URL}/api/photos/${ids[0]}/analyze`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify({ model: "medsiglip" }),
    });

    if (!analyzeResp.ok) {
      const text = await analyzeResp.text();
      return res.status(502).json({ success: false, detail: `Analyze failed: ${text.slice(0, 300)}` });
    }

    const analysisJson = await analyzeResp.json();
    const predictions = analysisJson.predictions || [];

    return res.status(200).json({
      success: true,
      top_prediction: predictions[0] || null,
      predictions,
    });

  } catch (err) {
    return res.status(500).json({ success: false, detail: String(err) });
  }
}

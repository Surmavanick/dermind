export const config = { runtime: "edge", maxDuration: 60 };

const HF_SPACE_URL = "https://mstepien-dermatolog-ai-scan.hf.space";

export default async function handler(request) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ success: false, detail: "Method not allowed" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    // Step 1: get session cookie
    const initResp = await fetch(`${HF_SPACE_URL}/`, { redirect: "follow" });
    const setCookie = initResp.headers.get("set-cookie") || "";
    const cookie = setCookie.split(";")[0] || "";

    // Step 2: parse incoming FormData (field: "file") → rebuild with "files"
    const incoming = await request.formData();
    const file = incoming.get("file");
    if (!file) {
      return new Response(JSON.stringify({ success: false, detail: "No file provided" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }

    const uploadForm = new FormData();
    uploadForm.append("files", file, file.name || "image.jpg");

    const uploadResp = await fetch(`${HF_SPACE_URL}/api/photos/upload`, {
      method: "POST",
      headers: cookie ? { cookie } : {},
      body: uploadForm,
    });

    if (!uploadResp.ok) {
      const text = await uploadResp.text();
      return new Response(JSON.stringify({ success: false, detail: `Upload failed: ${text.slice(0, 300)}` }), {
        status: 502,
        headers: { "content-type": "application/json" },
      });
    }

    const uploadJson = await uploadResp.json();
    const ids = uploadJson.ids || [];
    if (!ids.length) {
      return new Response(JSON.stringify({ success: false, detail: "No photo id returned" }), {
        status: 502,
        headers: { "content-type": "application/json" },
      });
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
      return new Response(JSON.stringify({ success: false, detail: `Analyze failed: ${text.slice(0, 300)}` }), {
        status: 502,
        headers: { "content-type": "application/json" },
      });
    }

    const analysisJson = await analyzeResp.json();
    const predictions = analysisJson.predictions || [];

    return new Response(JSON.stringify({
      success: true,
      top_prediction: predictions[0] || null,
      predictions,
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, detail: String(err) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

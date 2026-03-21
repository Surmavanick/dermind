export const config = { runtime: "edge" };

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
    const initResp = await fetch(`${HF_SPACE_URL}/`, {
      method: "GET",
      redirect: "follow",
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    const setCookie = initResp.headers.get("set-cookie") || initResp.headers.get("Set-Cookie") || "";
    const sessionMatch = setCookie.match(/session_id=[^;]+/i);
    const cookie = sessionMatch ? sessionMatch[0] : "";
    if (!cookie) {
      return new Response(
        JSON.stringify({ success: false, detail: "HF session cookie was not issued. Try again in a few seconds." }),
        { status: 502, headers: { "content-type": "application/json" } }
      );
    }

    // Step 2: parse incoming file and re-send with correct field name "files"
    const incoming = await request.formData();
    const file = incoming.get("file");
    if (!file) {
      return new Response(JSON.stringify({ success: false, detail: "No file provided" }), { status: 400 });
    }

    const uploadForm = new FormData();
    uploadForm.append("files", file, file.name || "image.jpg");

    const uploadResp = await fetch(`${HF_SPACE_URL}/api/photos/upload`, {
      method: "POST",
      headers: {
        cookie,
        accept: "application/json",
      },
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
      return new Response(JSON.stringify({ success: false, detail: `No photo id returned: ${JSON.stringify(uploadJson).slice(0, 300)}` }), {
        status: 502,
        headers: { "content-type": "application/json" },
      });
    }

    // Step 3: analyze
    const analyzeResp = await fetch(`${HF_SPACE_URL}/api/photos/${ids[0]}/analyze`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie,
        accept: "application/json",
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
    }), { status: 200, headers: { "content-type": "application/json" } });

  } catch (err) {
    return new Response(JSON.stringify({ success: false, detail: String(err) }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
}

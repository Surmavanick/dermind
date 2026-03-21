export const config = { maxDuration: 60, api: { bodyParser: false } };

const HF_SPACE_URL = "https://mstepien-dermatolog-ai-scan.hf.space";

export default async function handler(req, res) {
  try {
    const resp = await fetch(`${HF_SPACE_URL}/`, { redirect: "follow" });
    const cookie = (resp.headers.get("set-cookie") || "").split(";")[0];
    res.status(200).json({ ok: true, awake: resp.ok, cookie: !!cookie });
  } catch (err) {
    res.status(200).json({ ok: false, detail: String(err) });
  }
}

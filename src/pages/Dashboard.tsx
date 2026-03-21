import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const AUTH_KEY = "doctor_auth_session";

const DISEASE_REPORTS: Record<string, string> = {
  "Acne Vulgaris":
    "Acne Vulgaris is a chronic inflammatory dermatosis of the pilosebaceous unit, characterized by follicular hyperkeratinization, excess sebum production, colonization by Cutibacterium acnes, and subsequent inflammatory response. Clinical presentation includes non-inflammatory lesions (open and closed comedones) and inflammatory lesions (papules, pustules, nodules, and cysts), predominantly affecting sebaceous gland-rich areas such as the face, chest, and back. Severity is classified using the Global Acne Grading System (GAGS). Treatment is stratified by severity: topical retinoids and benzoyl peroxide for mild-to-moderate disease; systemic antibiotics or hormonal therapy for moderate disease; and oral isotretinoin for severe or refractory cases.",
  Rosacea:
    "A chronic facial skin condition causing redness, visible blood vessels, and sometimes pimples. Most common in fair-skinned adults aged 30–50.",
  "Herpes Zoster":
    "A viral infection caused by the reactivation of the varicella-zoster virus. Causes a painful rash with blisters, typically on one side of the body.",
  "Molluscum Contagiosum":
    "A viral skin infection causing small, round, painless bumps with a dimple in the center. Spreads by direct contact and resolves on its own over time.",
  "Atopic Dermatitis":
    "A chronic form of eczema causing itchy, inflamed, and dry skin. Often starts in childhood and is associated with allergies and asthma.",
  Psoriasis:
    "A chronic autoimmune disease causing red, scaly patches. Commonly affects elbows, knees, and scalp. Cycles of flare-ups and remissions.",
  "Seborrheic Keratosis":
    "A common noncancerous skin growth that appears as a waxy, scaly, slightly raised brown or black patch. More common with age.",
  Warts:
    "Rough, hard growths caused by the human papillomavirus (HPV). Can appear anywhere on the body and spread by touch.",
  Melanoma:
    "The most dangerous form of skin cancer. Look for asymmetric, irregular, multi-colored moles. Early detection is critical.",
  "Basal Cell Carcinoma":
    "The most common skin cancer. Grows slowly and rarely spreads, but damages surrounding tissue if left untreated.",
};

interface Prediction {
  label: string;
  score: number;
}

const Dashboard = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState("Waiting for image...");
  const [loading, setLoading] = useState(false);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [top, setTop] = useState<Prediction | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!localStorage.getItem(AUTH_KEY)) {
      window.location.href = "/doctor-login";
    }
  }, []);

  const handleFile = (f: File) => {
    setFile(f);
    setPreview(URL.createObjectURL(f));
    setPredictions([]);
    setTop(null);
    setStatus(`Selected: ${f.name}`);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    setLoading(true);
    setStatus("Analyzing...");
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await fetch("/api/hf/analyze", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.detail || "Failed");
      const preds: Prediction[] = data.predictions || [];
      const topPred = data.top_prediction || preds[0] || null;
      setPredictions(preds.slice(0, 8));
      setTop(topPred);
      setStatus("Done.");
    } catch (e: unknown) {
      setStatus(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setFile(null);
    setPreview(null);
    setPredictions([]);
    setTop(null);
    setStatus("Waiting for image...");
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDownloadPDF = () => {
    if (!top) return;
    const desc = DISEASE_REPORTS[top.label] || `Detected: ${top.label}`;
    const date = new Date().toLocaleString();
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Dermind Report</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 40px; color: #0f172a; }
        h1 { color: #0d9488; }
        .section { margin-top: 20px; }
        .label { color: #5b6477; font-size: 0.85rem; text-transform: uppercase; }
        .value { font-size: 1.2rem; font-weight: bold; }
        p { line-height: 1.6; }
        .footer { margin-top: 40px; font-size: 0.75rem; color: #999; }
      </style></head>
      <body>
        <h1>Dermind — Skin Scan Report</h1>
        <div class="section"><div class="label">Date</div><div>${date}</div></div>
        <div class="section">
          <div class="label">Top Prediction</div>
          <div class="value">${top.label}</div>
          <div>Confidence: ${(top.score * 100).toFixed(2)}%</div>
        </div>
        <div class="section"><div class="label">Description</div><p>${desc}</p></div>
        <div class="footer">This report is generated by Dermind AI and is not a substitute for professional medical advice.</div>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  const report = top ? DISEASE_REPORTS[top.label] || `Detected condition: ${top.label}. Please consult a dermatologist.` : null;

  return (
    <div className="min-h-screen bg-background px-6 py-10">
      <div className="max-w-5xl mx-auto">
        <p className="text-xs font-bold tracking-widest uppercase text-teal-700 mb-1">Remote Inference Dashboard</p>
        <h1 className="text-4xl font-bold mb-2">Skin Scan Dermind</h1>
        <p className="text-muted-foreground text-sm mb-8">
          Upload one image and this dashboard will proxy request to{" "}
          <code>mstepien/Dermatolog-AI-Scan</code> using backend API.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          {/* Upload */}
          <div className="border rounded-2xl p-6 bg-card">
            <h2 className="font-semibold mb-4">1. Upload Image</h2>
            <label
              className="flex flex-col items-center justify-center border-2 border-dashed border-teal-400 rounded-xl bg-teal-50 cursor-pointer h-40 mb-4 text-center px-4"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
            >
              <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
              <span className="font-semibold text-sm">Drop CDI here or click browse here</span>
              <span className="text-xs text-muted-foreground mt-1">CDI document</span>
            </label>
            <div className="flex gap-3 mb-3">
              <Button disabled={!file || loading} onClick={handleAnalyze}>Analyze</Button>
              <Button variant="outline" disabled={!file} onClick={handleClear}>Clear</Button>
            </div>
            <p className="text-sm text-muted-foreground">{status}</p>
          </div>

          {/* Preview */}
          <div className="border rounded-2xl p-6 bg-card">
            <h2 className="font-semibold mb-4">2. Preview</h2>
            <div className="rounded-xl overflow-hidden h-48 flex items-center justify-center bg-muted">
              {preview ? <img src={preview} alt="Preview" className="object-cover w-full h-full" /> : <span className="text-muted-foreground text-sm">No image selected</span>}
            </div>
          </div>
        </div>

        {/* Results */}
        {top && (
          <div className="border rounded-2xl p-6 bg-card">
            <h2 className="font-semibold mb-4">3. Results</h2>
            <div className="border rounded-xl p-4 mb-4">
              <p className="text-xs text-muted-foreground mb-1">Top prediction</p>
              <h3 className="text-2xl font-bold">{top.label}</h3>
              <p className="text-teal-600 font-semibold">{(top.score * 100).toFixed(2)}%</p>
            </div>
            <div className="space-y-2 mb-6">
              {predictions.map((p) => (
                <div key={p.label} className="flex justify-between border rounded-lg px-4 py-2 text-sm">
                  <span className="font-medium">{p.label}</span>
                  <span>{(p.score * 100).toFixed(2)}%</span>
                </div>
              ))}
            </div>
            {report && (
              <div>
                <h4 className="font-semibold mb-2">Report</h4>
                <p className="text-sm text-muted-foreground leading-relaxed mb-4">{report}</p>
                <Button onClick={handleDownloadPDF}>Download Report PDF</Button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;

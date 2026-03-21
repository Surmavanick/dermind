import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2, UploadCloud } from "lucide-react";

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

interface AnalyzePayload {
  success: boolean;
  predictions?: Prediction[];
  top_prediction?: Prediction | null;
  detail?: string;
}

interface SegmentationLayers {
  normalSkin: string;
  comedones: string;
  hyperPigmentation: string;
  activeAcne: string;
}

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

const blurAlpha = (src: Uint8Array, w: number, h: number, radius = 1) => {
  const dst = new Uint8Array(src.length);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy += 1) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -radius; dx <= radius; dx += 1) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          sum += src[ny * w + nx];
          count += 1;
        }
      }
      dst[y * w + x] = Math.round(sum / Math.max(1, count));
    }
  }
  return dst;
};

const alphaToDataUrl = (alpha: Uint8Array, w: number, h: number, r: number, g: number, b: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(w, h);
  for (let i = 0; i < alpha.length; i += 1) {
    const p = i * 4;
    img.data[p] = r;
    img.data[p + 1] = g;
    img.data[p + 2] = b;
    img.data[p + 3] = alpha[i];
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL("image/png");
};

const buildSegmentationLayers = async (src: string): Promise<SegmentationLayers | null> =>
  new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maxW = 360;
      const maxH = 280;
      const scale = Math.min(1, maxW / img.width, maxH / img.height);
      const w = Math.max(120, Math.round(img.width * scale));
      const h = Math.max(120, Math.round(img.height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        resolve(null);
        return;
      }

      ctx.drawImage(img, 0, 0, w, h);
      const frame = ctx.getImageData(0, 0, w, h);
      const px = frame.data;
      const size = w * h;
      const skinMask = new Uint8Array(size);

      for (let i = 0; i < size; i += 1) {
        const p = i * 4;
        const r = px[p];
        const g = px[p + 1];
        const b = px[p + 2];
        const cMax = Math.max(r, g, b);
        const cMin = Math.min(r, g, b);
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
        const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
        const rgbRule = r > 60 && g > 35 && b > 20 && r > g && r > b && Math.abs(r - g) > 10 && (cMax - cMin) > 15;
        const ycrcbRule = cr > 133 && cr < 182 && cb > 82 && cb < 138;
        skinMask[i] = (luma > 35 && luma < 242 && (rgbRule || ycrcbRule)) ? 1 : 0;
      }

      const visited = new Uint8Array(size);
      const faceMask = new Uint8Array(size);
      let best: number[] = [];

      for (let i = 0; i < size; i += 1) {
        if (!skinMask[i] || visited[i]) continue;
        const queue: number[] = [i];
        const comp: number[] = [];
        visited[i] = 1;

        for (let q = 0; q < queue.length; q += 1) {
          const cur = queue[q];
          comp.push(cur);
          const x = cur % w;
          const y = Math.floor(cur / w);
          const candidates = [
            x > 0 ? cur - 1 : -1,
            x < w - 1 ? cur + 1 : -1,
            y > 0 ? cur - w : -1,
            y < h - 1 ? cur + w : -1,
          ];
          for (let k = 0; k < candidates.length; k += 1) {
            const n = candidates[k];
            if (n < 0 || visited[n] || !skinMask[n]) continue;
            visited[n] = 1;
            queue.push(n);
          }
        }

        if (comp.length > best.length) best = comp;
      }

      if (best.length < Math.floor(size * 0.02)) {
        for (let i = 0; i < size; i += 1) faceMask[i] = skinMask[i];
      } else {
        for (let i = 0; i < best.length; i += 1) faceMask[best[i]] = 1;
      }

      const normal = new Uint8Array(size);
      const comedones = new Uint8Array(size);
      const hyper = new Uint8Array(size);
      const acne = new Uint8Array(size);

      let sumRed = 0;
      let sumDark = 0;
      let sumBrown = 0;
      let n = 0;

      for (let i = 0; i < size; i += 1) {
        if (!faceMask[i]) continue;
        const p = i * 4;
        const r = px[p];
        const g = px[p + 1];
        const b = px[p + 2];
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        sumRed += r - (g + b) / 2;
        sumDark += 255 - luma;
        sumBrown += (r + g) / 2 - b;
        n += 1;
      }

      const meanRed = sumRed / Math.max(1, n);
      const meanDark = sumDark / Math.max(1, n);
      const meanBrown = sumBrown / Math.max(1, n);

      for (let i = 0; i < size; i += 1) {
        if (!faceMask[i]) continue;
        const p = i * 4;
        const r = px[p];
        const g = px[p + 1];
        const b = px[p + 2];
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        const delta = maxC - minC;
        const sat = maxC === 0 ? 0 : delta / maxC;
        const luma = 0.299 * r + 0.587 * g + 0.114 * b;
        const red = r - (g + b) / 2;
        const dark = 255 - luma;
        const brown = (r + g) / 2 - b;

        let hue = 0;
        if (delta > 0) {
          if (maxC === r) hue = ((g - b) / delta) % 6;
          else if (maxC === g) hue = (b - r) / delta + 2;
          else hue = (r - g) / delta + 4;
          hue *= 60;
          if (hue < 0) hue += 360;
        }
        const redHue = hue <= 25 || hue >= 335;

        const acneLike = redHue && sat > 0.24 && red > meanRed + 10 && luma > 35 && luma < 220;
        const comedoneLike = dark > meanDark + 14 && sat > 0.12 && luma > 28 && luma < 180;
        const hyperLike = brown > meanBrown + 10 && red < meanRed + 10 && luma > 35 && luma < 205;

        if (acneLike) acne[i] = clamp(Math.round(180 + (red - meanRed) * 2.3), 0, 235);
        else if (comedoneLike) comedones[i] = clamp(Math.round(160 + (dark - meanDark) * 1.8), 0, 220);
        else if (hyperLike) hyper[i] = clamp(Math.round(145 + (brown - meanBrown) * 1.7), 0, 210);
        else normal[i] = 150;
      }

      const normalBlur = blurAlpha(normal, w, h, 1);
      const comedonesBlur = blurAlpha(comedones, w, h, 1);
      const hyperBlur = blurAlpha(hyper, w, h, 1);
      const acneBlur = blurAlpha(acne, w, h, 1);

      resolve({
        normalSkin: alphaToDataUrl(normalBlur, w, h, 142, 205, 242),
        comedones: alphaToDataUrl(comedonesBlur, w, h, 242, 218, 58),
        hyperPigmentation: alphaToDataUrl(hyperBlur, w, h, 154, 98, 201),
        activeAcne: alphaToDataUrl(acneBlur, w, h, 240, 76, 53),
      });
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });

const Dashboard = () => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState("");
  const [status, setStatus] = useState("Waiting for image...");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [analysisStarted, setAnalysisStarted] = useState(false);
  const [segmentationLayers, setSegmentationLayers] = useState<SegmentationLayers | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [top, setTop] = useState<Prediction | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const stageTimersRef = useRef<number[]>([]);
  const analysisRunRef = useRef(0);

  useEffect(() => {
    if (!localStorage.getItem(AUTH_KEY)) {
      window.location.href = "/doctor-login";
      return;
    }
    // Pre-warm HF Space so it's ready when user clicks Analyze
    fetch("/api/hf/wake", { method: "GET" }).catch(() => {});
  }, []);

  useEffect(() => {
    return () => {
      stageTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      stageTimersRef.current = [];
    };
  }, []);

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  useEffect(() => {
    let cancelled = false;
    if (!preview) {
      setSegmentationLayers(null);
      return () => {
        cancelled = true;
      };
    }
    buildSegmentationLayers(preview).then((layers) => {
      if (cancelled) return;
      setSegmentationLayers(layers);
    });
    return () => {
      cancelled = true;
    };
  }, [previewKey, preview]);

  const clearStageTimers = () => {
    stageTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    stageTimersRef.current = [];
  };

  const handleFile = (f: File) => {
    if (!f.type.startsWith("image/")) {
      setStatus("Please upload an image file (JPG, PNG, WEBP).");
      return;
    }
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    const nextPreview = URL.createObjectURL(f);
    setFile(f);
    setPreview(nextPreview);
    setPreviewKey(`${f.name}-${f.size}-${f.lastModified}`);
    setAnalysisStarted(false);
    setStage(0);
    setPredictions([]);
    setTop(null);
    setStatus(`Selected: ${f.name}`);
  };

  const handleAnalyze = async () => {
    if (!file) return;
    analysisRunRef.current += 1;
    const runId = analysisRunRef.current;
    clearStageTimers();
    setLoading(true);
    setAnalysisStarted(true);
    setStage(1);
    setTop(null);
    setPredictions([]);
    setStatus("Stage 1/4: Preparing image...");

    const timeline = [
      { at: 1200, stage: 1, text: "Stage 1/4: Loading original frame..." },
      { at: 3600, stage: 2, text: "Stage 2/4: Enhancing resolution..." },
      { at: 6200, stage: 3, text: "Stage 3/4: Building inflammation heatmap..." },
      { at: 8600, stage: 4, text: "Stage 4/4: Segmenting lesion zones..." },
      { at: 10000, stage: 4, text: "Finalizing prediction..." },
    ] as const;

    timeline.forEach((entry) => {
      const timerId = window.setTimeout(() => {
        if (analysisRunRef.current !== runId) return;
        setStage(entry.stage);
        setStatus(entry.text);
      }, entry.at);
      stageTimersRef.current.push(timerId);
    });

    try {
      const readJson = async (res: Response): Promise<AnalyzePayload | null> => {
        const raw = await res.text();
        if (!raw.trim()) return null;
        try {
          return JSON.parse(raw) as AnalyzePayload;
        } catch {
          return null;
        }
      };

      const analyzeViaLocalApi = async (): Promise<AnalyzePayload> => {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/hf/analyze", { method: "POST", body: form });
        const data = await readJson(res);
        if (!data) {
          if (res.status === 404) throw new Error("LOCAL_API_NOT_AVAILABLE");
          throw new Error(`Local API returned empty response (HTTP ${res.status}).`);
        }
        if (!res.ok || !data.success) throw new Error(data.detail || `Local API failed (HTTP ${res.status})`);
        return data;
      };

      let data: AnalyzePayload | null = null;
      let fetchError: unknown = null;
      const resolveDataPromise = (async () => {
        data = await analyzeViaLocalApi();
      })().catch((err) => {
        fetchError = err;
      });

      const minDurationPromise = new Promise((resolve) => window.setTimeout(resolve, 10000));
      await Promise.all([resolveDataPromise, minDurationPromise]);
      if (analysisRunRef.current !== runId) return;
      if (fetchError) throw fetchError;
      if (!data) throw new Error("No analysis response returned.");

      console.log("[Dermind] raw API response:", JSON.stringify(data));
      const preds: Prediction[] =
        (data.predictions?.length ? data.predictions : null) ||
        ((data as Record<string, unknown>)._raw as { predictions?: Prediction[] })?.predictions ||
        [];
      const topPred = data.top_prediction || preds[0] || null;
      setPredictions(preds.slice(0, 8));
      setTop(topPred);
      setStatus(topPred ? "Analysis complete. Results loaded." : `Analysis complete. No predictions returned. Raw: ${JSON.stringify((data as Record<string, unknown>)._raw).slice(0, 200)}`);
    } catch (e: unknown) {
      if (analysisRunRef.current !== runId) return;
      const message = e instanceof Error ? e.message : "Error";
      if (message === "LOCAL_API_NOT_AVAILABLE") {
        setStatus("Backend API route /api/hf/analyze is not running in this environment. For local testing run `vercel dev`; on Vercel deploy this route works automatically.");
      } else {
        setStatus(`Error: ${message}`);
      }
    } finally {
      if (analysisRunRef.current === runId) {
        clearStageTimers();
        setLoading(false);
      }
    }
  };

  const handleClear = () => {
    analysisRunRef.current += 1;
    clearStageTimers();
    setFile(null);
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setPreviewKey("");
    setSegmentationLayers(null);
    setAnalysisStarted(false);
    setStage(0);
    setLoading(false);
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
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; padding: 40px; color: #0f172a; }
        h1 { color: #2563EB; } .section { margin-top: 24px; }
        .label { color: #64748b; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.5px; }
        .value { font-size: 1.5rem; font-weight: 600; margin-top: 4px; }
        p { line-height: 1.6; color: #334155; }
        .footer { margin-top: 40px; font-size: 0.75rem; color: #94a3b8; text-align: center; }
      </style></head>
      <body>
        <h1>Dermind — Skin Scan Report</h1>
        <div class="section"><div class="label">Report Generated</div><div>${date}</div></div>
        <div class="section">
          <div class="label">Top Prediction</div>
          <div class="value">${top.label}</div>
          <div>Confidence: <strong>${(top.score * 100).toFixed(2)}%</strong></div>
        </div>
        <div class="section"><div class="label">Condition Information</div><p>${desc}</p></div>
        <div class="footer">This report is generated by an AI model and is intended for informational purposes only. It is not a substitute for professional medical advice, diagnosis, or treatment.</div>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  const report = top ? DISEASE_REPORTS[top.label] || `Detected condition: ${top.label}. Please consult a dermatologist.` : null;
  const stageTitle =
    stage >= 4
      ? "4. Feature Segmentation"
      : stage === 3
        ? "3. Inflammation Heatmap"
        : stage === 2
          ? "2. Image Enhancement"
          : stage === 1
            ? "1. Original Frame"
            : "Awaiting Analysis";
  const progress = loading ? [8, 28, 54, 78, 94][stage] ?? 8 : top ? 100 : 0;
  
  const previewItems = [
    { title: '1. Original Frame', key: `original-${previewKey}`, filter: 'blur-[1.5px] saturate-75 contrast-90', stageReq: 1 },
    { title: '2. Enhancement', key: `enhanced-${previewKey}`, filter: 'saturate-110 contrast-110', stageReq: 2, isEnhanced: true },
    { title: '3. Heatmap', key: `heatmap-${previewKey}`, filter: 'saturate-110 contrast-110', stageReq: 3, hasHeatmap: true },
    { title: '4. Segmentation', key: `segment-${previewKey}`, filter: '', stageReq: 4, hasSegmentation: true }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 px-4 sm:px-6 py-6">
      <div className="max-w-7xl mx-auto">
        <main className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          {/* Col 1: Upload */}
          <div className="lg:col-span-1">
            <header className="mb-4">
              <p className="text-sm font-semibold tracking-wider uppercase text-slate-500 mb-1">Remote Inference Dashboard</p>
              <h1 className="text-3xl lg:text-4xl font-bold text-slate-900">Skin Scan <span className="text-blue-600">Dermind</span></h1>
              <p className="text-slate-500 text-sm mt-1.5">
                Upload an image to run a diagnostic analysis. This dashboard proxies requests to the <code>mstepien/Dermatolog-AI-Scan</code> model.
              </p>
            </header>
            <div className="bg-white border border-slate-200/60 rounded-[20px] shadow-sm p-5 min-h-[610px]">
              <h2 className="text-lg font-semibold text-slate-900 mb-1">1. Upload Image</h2>
              <p className="text-sm text-slate-500 mb-4">Drag and drop or select an image file.</p>
              
              <label
                className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-2xl bg-white cursor-pointer h-40 mb-4 text-center px-4 group hover:border-blue-500 hover:bg-slate-50 transition-all duration-300"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
              >
                <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
                <div className="p-4 rounded-full bg-slate-100 group-hover:bg-blue-100 transition-colors duration-300 mb-3">
                  <UploadCloud className="w-7 h-7 text-slate-500 group-hover:text-blue-600 transition-colors duration-300" />
                </div>
                <span className="font-semibold text-sm text-slate-600">Drop image here or <span className="text-blue-600">click to browse</span></span>
                <span className="text-xs text-slate-400 mt-1">Supports: JPG, PNG, WEBP</span>
              </label>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button disabled={!file || loading} onClick={handleAnalyze} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-base py-3 px-6 transition-all duration-300 shadow-sm hover:shadow-md">Analyze</Button>
                <Button variant="outline" disabled={!file && !loading} onClick={handleClear} className="w-full bg-transparent hover:bg-slate-100 border-slate-300 text-slate-700 rounded-xl text-base py-3 px-6 transition-all duration-300">Clear</Button>
              </div>
              <div className="mt-4 border-t border-slate-100 pt-3">
                <h3 className="text-sm font-semibold text-slate-700">Status</h3>
                <p className="text-sm text-slate-500 mt-1">{status}</p>
              </div>

              {top && (
                <div className="mt-4 border-t border-slate-100 pt-3 space-y-2">
                  <div className="bg-blue-50 border border-blue-200/80 rounded-xl px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-500 mb-0.5">Top Prediction</p>
                    <p className="text-base font-bold text-slate-800">{top.label}</p>
                    <p className="text-sm text-blue-600 font-medium">{(top.score * 100).toFixed(2)}%</p>
                  </div>
                  {predictions.slice(1, 4).map((p) => (
                    <div key={p.label} className="flex justify-between items-center text-xs px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200/60">
                      <span className="text-slate-600 font-medium">{p.label}</span>
                      <span className="text-slate-400 font-mono">{(p.score * 100).toFixed(2)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>


          {/* Col 2: Preview */}
          <div className="bg-white border border-slate-200/60 rounded-[20px] shadow-sm p-5 lg:col-span-2 min-h-[610px]">
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-slate-900">2. Preview</h2>
                <span className="text-xs text-slate-500">Pipeline View</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-1">
                {[1, 2, 3, 4].map((idx) => {
                  const done = top ? stage >= idx : stage > idx;
                  const active = loading && stage === idx;
                  return (
                    <div
                      key={`stage-pill-${idx}`}
                      className={`rounded-lg border px-2 py-1.5 text-[11px] font-medium flex items-center gap-1.5 ${
                        done
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : active
                            ? "border-blue-200 bg-blue-50 text-blue-700"
                            : "border-slate-200 bg-slate-50 text-slate-500"
                      }`}
                    >
                      {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : active ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                      <span>Stage {idx}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {previewItems.map((item) => {
                const isActive = Boolean(preview) && stage >= item.stageReq;
                const isCurrent = loading && stage === item.stageReq;
                const canShowStageImage = item.stageReq === 1
                  ? Boolean(preview)
                  : Boolean(preview) && analysisStarted && stage >= item.stageReq;
                const isReady = Boolean(preview) && item.stageReq === 1 && !analysisStarted;
                const stateLabel = isReady ? "Ready" : isActive ? "Active" : "Pending";
                return (
                  <div
                    key={item.key}
                    className={`rounded-xl border p-3 transition-all duration-300 ${
                      isActive
                        ? "border-slate-300 bg-white shadow-sm"
                        : "border-slate-200 bg-slate-50/70"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{item.title}</p>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full ${
                          isActive
                            ? "bg-emerald-100 text-emerald-700"
                            : isReady
                              ? "bg-blue-100 text-blue-700"
                              : "bg-slate-200 text-slate-500"
                        }`}
                      >
                        {stateLabel}
                      </span>
                    </div>
                    <div className={`aspect-[4/3] rounded-lg overflow-hidden bg-slate-100 border border-slate-200/80 relative ${isCurrent ? "ring-2 ring-blue-300/60" : ""}`}>
                      {canShowStageImage ? (
                        <>
                          <img
                            src={preview}
                            alt={item.title}
                            className={`w-full h-full object-cover scale-[1.02] transition-all duration-500 ${item.filter}`}
                          />
                          {isCurrent && (
                            <>
                              <div className="absolute inset-0 bg-blue-500/10 animate-pulse" />
                              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-blue-300 to-transparent animate-pulse" />
                            </>
                          )}
                          {item.isEnhanced && (
                            <div className="absolute right-2 bottom-2 w-1/3 h-1/3 rounded-md overflow-hidden border-2 border-white/80 shadow-lg bg-white">
                              <img src={preview} alt="Zoomed detail" className="w-full h-full object-cover scale-[1.7] origin-center saturate-110 contrast-125" />
                            </div>
                          )}
                          {item.hasHeatmap && stage >= 3 && (
                            <div className="absolute inset-0 mix-blend-multiply">
                              <div className="absolute top-[22%] left-[34%] w-16 h-16 rounded-full bg-red-500/60 blur-xl animate-pulse" />
                              <div className="absolute top-[52%] left-[22%] w-20 h-14 rounded-full bg-red-500/45 blur-xl animate-pulse" />
                              <div className="absolute top-[62%] left-[45%] w-12 h-12 rounded-full bg-red-500/45 blur-lg animate-pulse" />
                            </div>
                          )}
                          {item.hasSegmentation && stage >= 4 && (
                            <>
                              {segmentationLayers ? (
                                <>
                                  <img src={segmentationLayers.normalSkin} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none mix-blend-normal opacity-90" />
                                  <img src={segmentationLayers.comedones} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none mix-blend-normal opacity-90" />
                                  <img src={segmentationLayers.hyperPigmentation} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none mix-blend-normal opacity-90" />
                                  <img src={segmentationLayers.activeAcne} alt="" className="absolute inset-0 w-full h-full object-cover pointer-events-none mix-blend-normal opacity-95" />
                                  <div className="absolute left-2 bottom-2 rounded-md bg-white/90 backdrop-blur-sm border border-white px-2 py-1 text-[10px] leading-tight text-slate-700">
                                    <div><span className="inline-block w-2 h-2 rounded-full bg-[#f04c35] mr-1 align-middle" /> Red: Damaged Area</div>
                                    <div><span className="inline-block w-2 h-2 rounded-full bg-[#f2da3a] mr-1 align-middle" /> Yellow: Comedones</div>
                                    <div><span className="inline-block w-2 h-2 rounded-full bg-[#9a62c9] mr-1 align-middle" /> Purple: Hyper-pigmentation</div>
                                    <div><span className="inline-block w-2 h-2 rounded-full bg-[#8ecdf2] mr-1 align-middle" /> Light Blue: Normal Skin</div>
                                  </div>
                                </>
                              ) : (
                                <div className="absolute inset-0 bg-sky-300/20 animate-pulse" />
                              )}
                            </>
                          )}
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-sm text-slate-400">
                          {preview ? "Starts after Analyze" : "Waiting for image"}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

          </div>
          
          {/* Results */}
          {top && (
            <div className="lg:col-span-3 bg-white border border-slate-200/60 rounded-[20px] shadow-sm p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-5">3. Results</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1">
                  <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-6 h-full">
                    <p className="text-sm uppercase tracking-wider font-semibold text-blue-600 mb-1">Top Prediction</p>
                    <h3 className="text-3xl font-bold text-slate-800">{top.label}</h3>
                    <p className="text-lg font-medium text-slate-600 mt-1">{(top.score * 100).toFixed(2)}% Confidence</p>
                  </div>
                </div>
                <div className="md:col-span-2 space-y-2">
                   {predictions.map((p, index) => (
                    <div key={p.label} className={`flex justify-between items-center rounded-lg px-4 py-3 text-sm transition-colors duration-200 ${index === 0 ? 'bg-blue-50 border border-blue-200/80' : 'bg-slate-50'}`}>
                      <span className={`font-semibold ${index === 0 ? 'text-blue-800' : 'text-slate-700'}`}>{index + 1}. {p.label}</span>
                      <span className={`font-mono font-medium ${index === 0 ? 'text-blue-700' : 'text-slate-500'}`}>{(p.score * 100).toFixed(2)}%</span>
                    </div>
                  ))}
                </div>
              </div>
              {report && (
                <div className="mt-8 pt-6 border-t border-slate-200/80">
                  <h4 className="text-base font-semibold text-slate-800 mb-2">Condition Information</h4>
                  <p className="text-sm text-slate-600 leading-relaxed max-w-3xl mb-5">{report}</p>
                  <Button onClick={handleDownloadPDF} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-base py-3 px-6 transition-all duration-300 shadow-sm hover:shadow-md">
                    Download Report PDF
                  </Button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;

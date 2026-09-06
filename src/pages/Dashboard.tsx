import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Aperture, CheckCircle2, ClipboardList, Layers, Loader2, Sun, UploadCloud, X, Zap } from "lucide-react";
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

interface ChannelResult {
  id: number;
  name: string;
  detects?: string;
  predictions: Prediction[];
  top_prediction: Prediction | null;
  error?: string;
}

interface AnalyzePayload {
  success: boolean;
  predictions?: Prediction[];
  top_prediction?: Prediction | null;
  channels?: ChannelResult[];
  fusion?: { method: string; channels_used: number[]; channels_total: number };
  detail?: string;
}

interface SegmentationLayers {
  normalSkin: string;
  comedones: string;
  hyperPigmentation: string;
  activeAcne: string;
}

/* ------------------------------------------------------------------ */
/* Spectral capture channels                                           */
/* ------------------------------------------------------------------ */

interface ChannelDef {
  id: number;
  field: string;
  short: string;
  name: string;
  detects: string;
  icon: LucideIcon;
  badge: string;
}

const CHANNELS: ChannelDef[] = [
  {
    id: 1,
    field: "channel_1",
    short: "Ch 1",
    name: "Non-polarized",
    detects: "Surface texture, scales, milia",
    icon: Sun,
    badge: "bg-amber-100 text-amber-700",
  },
  {
    id: 2,
    field: "channel_2",
    short: "Ch 2",
    name: "Polarized",
    detects: "Vascular network, melanin depth, shiny white structures",
    icon: Aperture,
    badge: "bg-sky-100 text-sky-700",
  },
  {
    id: 3,
    field: "channel_3",
    short: "Ch 3",
    name: "UV / Blue Light",
    detects: "Fluorescence: fungi, bacteria, porphyrins",
    icon: Zap,
    badge: "bg-violet-100 text-violet-700",
  },
];

type ChannelSlot = { file: File; preview: string } | null;

/* ------------------------------------------------------------------ */
/* Patient anamnesis                                                   */
/* ------------------------------------------------------------------ */

interface Anamnesis {
  patientId: string;
  age: string;
  sex: string;
  site: string;
  duration: string;
  symptoms: string[];
  riskFactors: string[];
  notes: string;
}

const EMPTY_ANAMNESIS: Anamnesis = {
  patientId: "",
  age: "",
  sex: "",
  site: "",
  duration: "",
  symptoms: [],
  riskFactors: [],
  notes: "",
};

const SEX_OPTIONS = ["Female", "Male", "Other"];
const SYMPTOM_OPTIONS = ["Itching", "Pain", "Bleeding", "Growth or change", "Scaling", "Discharge"];
const RISK_OPTIONS = ["Personal skin cancer", "Family skin cancer", "Immunosuppression", "High sun exposure", "Allergies", "Diabetes"];

const anamnesisEntries = (a: Anamnesis): { label: string; value: string }[] =>
  [
    { label: "Patient ID", value: a.patientId.trim() },
    { label: "Age", value: a.age.trim() },
    { label: "Sex", value: a.sex },
    { label: "Lesion site", value: a.site.trim() },
    { label: "Duration", value: a.duration.trim() },
    { label: "Symptoms", value: a.symptoms.join(", ") },
    { label: "Risk factors", value: a.riskFactors.join(", ") },
    { label: "Notes", value: a.notes.trim() },
  ].filter((row) => row.value);

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

/* ------------------------------------------------------------------ */
/* Image helpers                                                       */
/* ------------------------------------------------------------------ */

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

const loadImage = (src: string) =>
  new Promise<HTMLImageElement | null>((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });

/**
 * Fuses the captured spectral channels into one image: every layer is
 * registered onto the first channel's frame and pixel-averaged with equal weight.
 */
const buildFusedMap = async (sources: string[]): Promise<string | null> => {
  const images = (await Promise.all(sources.map(loadImage))).filter((img): img is HTMLImageElement => Boolean(img));
  if (!images.length) return null;
  const base = images[0];
  const scale = Math.min(1, 720 / base.width);
  const w = Math.max(160, Math.round(base.width * scale));
  const h = Math.max(120, Math.round(base.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  // Sequential alpha 1, 1/2, 1/3 yields an equal-weight mean of all layers.
  images.forEach((img, i) => {
    ctx.globalAlpha = 1 / (i + 1);
    ctx.drawImage(img, 0, 0, w, h);
  });
  ctx.globalAlpha = 1;
  return canvas.toDataURL("image/jpeg", 0.9);
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

/* ------------------------------------------------------------------ */
/* Small form primitives                                               */
/* ------------------------------------------------------------------ */

const inputClass =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition";

const Field = ({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) => (
  <label className={`block ${className}`}>
    <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">{label}</span>
    {children}
  </label>
);

const ChipGroup = ({
  label,
  options,
  value,
  onToggle,
}: {
  label: string;
  options: string[];
  value: string[];
  onToggle: (opt: string) => void;
}) => (
  <div className="mt-3">
    <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">{label}</span>
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const on = value.includes(opt);
        return (
          <button
            type="button"
            key={opt}
            onClick={() => onToggle(opt)}
            className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
              on ? "bg-blue-600 border-blue-600 text-white" : "bg-white border-slate-200 text-slate-600 hover:border-blue-300"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

const Dashboard = () => {
  const [slots, setSlots] = useState<ChannelSlot[]>([null, null, null]);
  const [fusedPreview, setFusedPreview] = useState<string | null>(null);
  const [anamnesis, setAnamnesis] = useState<Anamnesis>(EMPTY_ANAMNESIS);
  const [status, setStatus] = useState("Waiting for spectral channels...");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [analysisStarted, setAnalysisStarted] = useState(false);
  const [segmentationLayers, setSegmentationLayers] = useState<SegmentationLayers | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [top, setTop] = useState<Prediction | null>(null);
  const [channelResults, setChannelResults] = useState<ChannelResult[]>([]);
  const [fusionInfo, setFusionInfo] = useState<{ used: number; total: number } | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const slotsRef = useRef<ChannelSlot[]>(slots);
  const stageTimersRef = useRef<number[]>([]);
  const analysisRunRef = useRef(0);

  slotsRef.current = slots;
  const previewKey = slots.map((s) => (s ? `${s.file.name}-${s.file.size}-${s.file.lastModified}` : "empty")).join("|");
  const loadedCount = slots.filter(Boolean).length;
  const allChannelsReady = loadedCount === CHANNELS.length;
  const anamnesisRows = anamnesisEntries(anamnesis);

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
      slotsRef.current.forEach((s) => {
        if (s) URL.revokeObjectURL(s.preview);
      });
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const sources = slots.filter((s): s is NonNullable<ChannelSlot> => Boolean(s)).map((s) => s.preview);
    if (!sources.length) {
      setFusedPreview(null);
      return () => {
        cancelled = true;
      };
    }
    buildFusedMap(sources).then((url) => {
      if (!cancelled) setFusedPreview(url);
    });
    return () => {
      cancelled = true;
    };
  }, [slots]);

  useEffect(() => {
    let cancelled = false;
    if (!fusedPreview) {
      setSegmentationLayers(null);
      return () => {
        cancelled = true;
      };
    }
    buildSegmentationLayers(fusedPreview).then((layers) => {
      if (cancelled) return;
      setSegmentationLayers(layers);
    });
    return () => {
      cancelled = true;
    };
  }, [fusedPreview]);

  const clearStageTimers = () => {
    stageTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    stageTimersRef.current = [];
  };

  const resetAnalysis = () => {
    analysisRunRef.current += 1;
    clearStageTimers();
    setLoading(false);
    setAnalysisStarted(false);
    setStage(0);
    setPredictions([]);
    setTop(null);
    setChannelResults([]);
    setFusionInfo(null);
  };

  /** Places dropped files into channel slots starting at `startIdx` (drop 3 files on Ch 1 to fill all). */
  const assignFiles = (startIdx: number, incoming: FileList | File[]) => {
    const images = Array.from(incoming).filter((f) => f.type.startsWith("image/"));
    if (!images.length) {
      setStatus("Please upload image files (JPG, PNG, WEBP).");
      return;
    }
    const entries = images.slice(0, CHANNELS.length - startIdx).map((file) => ({ file, preview: URL.createObjectURL(file) }));
    resetAnalysis();
    setSlots((prev) => {
      const next = [...prev];
      entries.forEach((entry, i) => {
        const current = next[startIdx + i];
        if (current && current.preview !== entry.preview) URL.revokeObjectURL(current.preview);
        next[startIdx + i] = entry;
      });
      return next;
    });
    const ch = CHANNELS[startIdx];
    setStatus(
      entries.length > 1
        ? `Loaded ${entries.length} channel images (${ch.short} onward).`
        : `${ch.short} · ${ch.name} ready: ${entries[0].file.name}`
    );
  };

  const removeChannel = (idx: number) => {
    resetAnalysis();
    setSlots((prev) => {
      const next = [...prev];
      const current = next[idx];
      if (current) URL.revokeObjectURL(current.preview);
      next[idx] = null;
      return next;
    });
    const input = inputRefs.current[idx];
    if (input) input.value = "";
    setStatus(`${CHANNELS[idx].short} cleared.`);
  };

  const toggleListValue = (key: "symptoms" | "riskFactors", opt: string) => {
    setAnamnesis((prev) => {
      const list = prev[key];
      return { ...prev, [key]: list.includes(opt) ? list.filter((v) => v !== opt) : [...list, opt] };
    });
  };

  const handleAnalyze = async () => {
    if (!allChannelsReady) return;
    const files = slots.map((s) => s!.file);
    analysisRunRef.current += 1;
    const runId = analysisRunRef.current;
    clearStageTimers();
    setLoading(true);
    setAnalysisStarted(true);
    setStage(1);
    setTop(null);
    setPredictions([]);
    setChannelResults([]);
    setFusionInfo(null);
    setStatus("Stage 1/4: Registering spectral channels...");

    const timeline = [
      { at: 1200, stage: 1, text: "Stage 1/4: Registering 3 spectral channels..." },
      { at: 3600, stage: 2, text: "Stage 2/4: Fusing layers into unified digital map..." },
      { at: 6200, stage: 3, text: "Stage 3/4: Mapping inflammation and vascular signal..." },
      { at: 8600, stage: 4, text: "Stage 4/4: Segmenting lesion zones..." },
      { at: 10000, stage: 4, text: "Combining channel evaluations..." },
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
        CHANNELS.forEach((ch, i) => form.append(ch.field, files[i], files[i].name));
        form.append("anamnesis", JSON.stringify(anamnesis));
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

      const payload: AnalyzePayload = data;
      console.log("[Dermio] raw API response:", JSON.stringify(payload));
      const preds: Prediction[] = payload.predictions ?? [];
      const topPred = payload.top_prediction || preds[0] || null;
      const used = payload.fusion?.channels_used?.length ?? (payload.channels?.filter((c) => c.predictions?.length).length ?? 0);
      const total = payload.fusion?.channels_total ?? CHANNELS.length;
      setPredictions(preds.slice(0, 8));
      setTop(topPred);
      setChannelResults(payload.channels ?? []);
      setFusionInfo({ used, total });
      setStatus(
        topPred
          ? `Combined evaluation complete: ${used}/${total} spectral channels fused.`
          : "Analysis complete. No predictions returned."
      );
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
    resetAnalysis();
    setSlots((prev) => {
      prev.forEach((s) => {
        if (s) URL.revokeObjectURL(s.preview);
      });
      return [null, null, null];
    });
    setSegmentationLayers(null);
    setStatus("Waiting for spectral channels...");
    inputRefs.current.forEach((input) => {
      if (input) input.value = "";
    });
  };

  const handleDownloadPDF = () => {
    if (!top) return;
    const desc = DISEASE_REPORTS[top.label] || `Detected: ${top.label}`;
    const date = new Date().toLocaleString();
    const win = window.open("", "_blank");
    if (!win) return;

    const anamnesisHtml = anamnesisRows.length
      ? `<table>${anamnesisRows
          .map((row) => `<tr><th>${escapeHtml(row.label)}</th><td>${escapeHtml(row.value)}</td></tr>`)
          .join("")}</table>`
      : `<p class="muted">No anamnesis recorded.</p>`;

    const channelRows = CHANNELS.map((ch) => {
      const result = channelResults.find((c) => c.id === ch.id);
      const topC = result?.top_prediction;
      return `<tr>
        <th>${escapeHtml(`${ch.short} · ${ch.name}`)}</th>
        <td>${escapeHtml(ch.detects)}</td>
        <td>${topC ? escapeHtml(topC.label) : `<span class="muted">${escapeHtml(result?.error || "No result")}</span>`}</td>
        <td>${topC ? `${(topC.score * 100).toFixed(2)}%` : "–"}</td>
      </tr>`;
    }).join("");

    win.document.write(`
      <html><head><title>Dermio Report</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; padding: 40px; color: #0f172a; }
        h1 { color: #2563EB; } .section { margin-top: 24px; }
        .label { color: #64748b; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.5px; }
        .value { font-size: 1.5rem; font-weight: 600; margin-top: 4px; }
        .muted { color: #94a3b8; }
        p { line-height: 1.6; color: #334155; }
        table { border-collapse: collapse; margin-top: 8px; width: 100%; font-size: 0.9rem; }
        th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
        th { color: #475569; font-weight: 600; white-space: nowrap; }
        .footer { margin-top: 40px; font-size: 0.75rem; color: #94a3b8; text-align: center; }
      </style></head>
      <body>
        <h1>Dermio — Multispectral Skin Scan Report</h1>
        <div class="section"><div class="label">Report Generated</div><div>${date}</div></div>
        <div class="section"><div class="label">Patient Anamnesis</div>${anamnesisHtml}</div>
        <div class="section">
          <div class="label">Combined Result</div>
          <div class="value">${escapeHtml(top.label)}</div>
          <div>Confidence: <strong>${(top.score * 100).toFixed(2)}%</strong></div>
          <div class="muted">Fused from ${fusionInfo ? `${fusionInfo.used}/${fusionInfo.total}` : "3/3"} spectral channels (non-polarized, polarized, UV / blue light) into a unified digital map.</div>
        </div>
        <div class="section">
          <div class="label">Per-channel Evaluation</div>
          <table>
            <tr><th>Channel</th><th>Detects</th><th>Top prediction</th><th>Confidence</th></tr>
            ${channelRows}
          </table>
        </div>
        <div class="section"><div class="label">Condition Information</div><p>${desc}</p></div>
        <div class="footer">This report is generated by an AI model and is intended for informational purposes only. It is not a substitute for professional medical advice, diagnosis, or treatment.</div>
      </body></html>
    `);
    win.document.close();
    win.print();
  };

  const report = top ? DISEASE_REPORTS[top.label] || `Detected condition: ${top.label}. Please consult a dermatologist.` : null;

  const stageLabels = ["Channels", "Fusion", "Heatmap", "Segmentation"];

  type Tile = {
    key: string;
    title: string;
    caption: string;
    src: string | null;
    stageReq: number;
    kind: "channel" | "fused" | "heatmap" | "segmentation";
    channel?: ChannelDef;
  };

  const tiles: Tile[] = [
    ...CHANNELS.map((ch, i): Tile => ({
      key: `ch${ch.id}-${previewKey}`,
      title: `1. ${ch.short} · ${ch.name}`,
      caption: ch.detects,
      src: slots[i]?.preview ?? null,
      stageReq: 1,
      kind: "channel",
      channel: ch,
    })),
    { key: `fused-${previewKey}`, title: "2. Unified Digital Map", caption: "Three spectral layers fused into one map", src: fusedPreview, stageReq: 2, kind: "fused" },
    { key: `heat-${previewKey}`, title: "3. Heatmap", caption: "Inflammation and vascular signal", src: fusedPreview, stageReq: 3, kind: "heatmap" },
    { key: `seg-${previewKey}`, title: "4. Segmentation", caption: "Lesion zones on the fused map", src: fusedPreview, stageReq: 4, kind: "segmentation" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 px-4 sm:px-6 py-6">
      <div className="max-w-7xl mx-auto">
        <main className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
          {/* Col 1: Anamnesis + Capture */}
          <div className="lg:col-span-1 space-y-5">
            <header>
              <p className="text-sm font-semibold tracking-wider uppercase text-slate-500 mb-1">Multispectral Inference Dashboard</p>
              <h1 className="text-3xl lg:text-4xl font-bold text-slate-900">Skin Scan <span className="text-blue-600">Dermio</span></h1>
              <p className="text-slate-500 text-sm mt-1.5">
                Capture three spectral channels (non-polarized, polarized, UV / blue light). Dermio fuses their layers into one digital map and returns a combined evaluation.
              </p>
            </header>

            {/* Patient anamnesis */}
            <div className="bg-white border border-slate-200/60 rounded-[20px] shadow-sm p-5">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-blue-600" />
                  1. Patient Anamnesis
                </h2>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${anamnesisRows.length ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {anamnesisRows.length ? "Recorded" : "Not recorded"}
                </span>
              </div>
              <p className="text-sm text-slate-500 mb-4">History is attached to the scan and included in the report.</p>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Patient ID">
                  <input className={inputClass} value={anamnesis.patientId} onChange={(e) => setAnamnesis((p) => ({ ...p, patientId: e.target.value }))} placeholder="e.g. P-0412" />
                </Field>
                <Field label="Age">
                  <input className={inputClass} type="number" min={0} max={120} value={anamnesis.age} onChange={(e) => setAnamnesis((p) => ({ ...p, age: e.target.value }))} placeholder="Years" />
                </Field>
                <Field label="Sex">
                  <select className={inputClass} value={anamnesis.sex} onChange={(e) => setAnamnesis((p) => ({ ...p, sex: e.target.value }))}>
                    <option value="">Select</option>
                    {SEX_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Lesion site">
                  <input className={inputClass} value={anamnesis.site} onChange={(e) => setAnamnesis((p) => ({ ...p, site: e.target.value }))} placeholder="e.g. left forearm" />
                </Field>
                <Field label="Duration / evolution" className="col-span-2">
                  <input className={inputClass} value={anamnesis.duration} onChange={(e) => setAnamnesis((p) => ({ ...p, duration: e.target.value }))} placeholder="e.g. 3 weeks, slowly growing" />
                </Field>
              </div>

              <ChipGroup label="Symptoms" options={SYMPTOM_OPTIONS} value={anamnesis.symptoms} onToggle={(opt) => toggleListValue("symptoms", opt)} />
              <ChipGroup label="Risk factors" options={RISK_OPTIONS} value={anamnesis.riskFactors} onToggle={(opt) => toggleListValue("riskFactors", opt)} />

              <Field label="Notes" className="mt-3">
                <textarea className={`${inputClass} resize-none`} rows={2} value={anamnesis.notes} onChange={(e) => setAnamnesis((p) => ({ ...p, notes: e.target.value }))} placeholder="Previous treatments, medications, relevant history..." />
              </Field>
            </div>

            {/* Spectral capture */}
            <div className="bg-white border border-slate-200/60 rounded-[20px] shadow-sm p-5">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-blue-600" />
                  2. Spectral Capture
                </h2>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${allChannelsReady ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                  {loadedCount}/{CHANNELS.length} channels
                </span>
              </div>
              <p className="text-sm text-slate-500 mb-4">Drop one photo per channel, or drop all three onto Ch 1.</p>

              <div className="space-y-2.5 mb-4">
                {CHANNELS.map((ch, idx) => {
                  const slot = slots[idx];
                  const Icon = ch.icon;
                  return (
                    <label
                      key={ch.id}
                      className={`relative flex items-center gap-3 border-2 border-dashed rounded-2xl px-3 py-2.5 cursor-pointer group transition-all duration-300 ${
                        slot ? "border-slate-200 bg-slate-50/70 hover:border-blue-400" : "border-slate-300 bg-white hover:border-blue-500 hover:bg-slate-50"
                      }`}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (e.dataTransfer.files?.length) assignFiles(idx, e.dataTransfer.files);
                      }}
                    >
                      <input
                        ref={(el) => {
                          inputRefs.current[idx] = el;
                        }}
                        type="file"
                        accept="image/*"
                        multiple={idx === 0}
                        className="hidden"
                        onChange={(e) => {
                          if (e.target.files?.length) assignFiles(idx, e.target.files);
                        }}
                      />
                      <div className="w-14 h-14 shrink-0 rounded-xl overflow-hidden bg-slate-100 border border-slate-200/80 flex items-center justify-center">
                        {slot ? (
                          <img src={slot.preview} alt={ch.name} className="w-full h-full object-cover" />
                        ) : (
                          <UploadCloud className="w-6 h-6 text-slate-400 group-hover:text-blue-600 transition-colors" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${ch.badge}`}>
                            <Icon className="w-3 h-3" />
                            {ch.short}
                          </span>
                          <span className="text-sm font-semibold text-slate-700 truncate">{ch.name}</span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{ch.detects}</p>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5">{slot ? slot.file.name : "Drop image or click to browse"}</p>
                      </div>
                      {slot ? (
                        <button
                          type="button"
                          aria-label={`Remove ${ch.name} image`}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            removeChannel(idx);
                          }}
                          className="shrink-0 p-1.5 rounded-full text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      ) : (
                        <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Empty</span>
                      )}
                    </label>
                  );
                })}
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button disabled={!allChannelsReady || loading} onClick={handleAnalyze} className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-base py-3 px-6 transition-all duration-300 shadow-sm hover:shadow-md">
                  {loading ? "Analyzing..." : "Analyze"}
                </Button>
                <Button variant="outline" disabled={!loadedCount && !loading} onClick={handleClear} className="w-full bg-transparent hover:bg-slate-100 border-slate-300 text-slate-700 rounded-xl text-base py-3 px-6 transition-all duration-300">
                  Clear
                </Button>
              </div>
              {!allChannelsReady && (
                <p className="text-[11px] text-slate-400 mt-2">Upload all three spectral channels to enable the combined analysis.</p>
              )}

              <div className="mt-4 border-t border-slate-100 pt-3">
                <h3 className="text-sm font-semibold text-slate-700">Status</h3>
                <p className="text-sm text-slate-500 mt-1">{status}</p>
              </div>

              {top && (
                <div className="mt-4 border-t border-slate-100 pt-3 space-y-2">
                  <div className="bg-blue-50 border border-blue-200/80 rounded-xl px-4 py-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-500 mb-0.5">Combined Prediction</p>
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

          {/* Col 2: Pipeline preview */}
          <div className="bg-white border border-slate-200/60 rounded-[20px] shadow-sm p-5 lg:col-span-2 min-h-[610px]">
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-semibold text-slate-900">3. Digital Map Pipeline</h2>
                <span className="text-xs text-slate-500">3 channels → 1 map → combined evaluation</span>
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
                      <span>Stage {idx} · {stageLabels[idx - 1]}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {tiles.map((tile) => {
                const hasSrc = Boolean(tile.src);
                const isActive = hasSrc && analysisStarted && stage >= tile.stageReq;
                const isCurrent = loading && stage === tile.stageReq;
                const canShow = hasSrc && (tile.stageReq === 1 || (analysisStarted && stage >= tile.stageReq));
                const isReady = hasSrc && tile.stageReq === 1 && !analysisStarted;
                const stateLabel = isReady ? "Ready" : isActive ? "Active" : "Pending";
                const emptyText = tile.kind === "channel"
                  ? `Waiting for ${tile.channel?.short}`
                  : hasSrc
                    ? "Starts after Analyze"
                    : "Waiting for channels";
                const ChannelIcon = tile.channel?.icon;
                return (
                  <div
                    key={tile.key}
                    className={`rounded-xl border p-3 transition-all duration-300 ${
                      isActive ? "border-slate-300 bg-white shadow-sm" : "border-slate-200 bg-slate-50/70"
                    }`}
                  >
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-600 truncate">{tile.title}</p>
                        <p className="text-[10px] text-slate-400 truncate">{tile.caption}</p>
                      </div>
                      <span
                        className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full ${
                          isActive ? "bg-emerald-100 text-emerald-700" : isReady ? "bg-blue-100 text-blue-700" : "bg-slate-200 text-slate-500"
                        }`}
                      >
                        {stateLabel}
                      </span>
                    </div>
                    <div className={`aspect-[4/3] rounded-lg overflow-hidden bg-slate-100 border border-slate-200/80 relative ${isCurrent ? "ring-2 ring-blue-300/60" : ""}`}>
                      {canShow && tile.src ? (
                        <>
                          <img
                            src={tile.src}
                            alt={tile.title}
                            className={`w-full h-full object-cover scale-[1.02] transition-all duration-500 ${tile.kind === "heatmap" ? "saturate-110 contrast-110" : ""}`}
                          />
                          {isCurrent && (
                            <>
                              <div className="absolute inset-0 bg-blue-500/10 animate-pulse" />
                              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-transparent via-blue-300 to-transparent animate-pulse" />
                            </>
                          )}
                          {tile.kind === "channel" && tile.channel && ChannelIcon && (
                            <span className={`absolute left-2 top-2 inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md shadow-sm ${tile.channel.badge}`}>
                              <ChannelIcon className="w-3 h-3" />
                              {tile.channel.name}
                            </span>
                          )}
                          {tile.kind === "fused" && (
                            <>
                              <div className="absolute inset-0 pointer-events-none opacity-25 bg-[linear-gradient(to_right,rgba(255,255,255,0.6)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.6)_1px,transparent_1px)] bg-[size:24px_24px]" />
                              <div className="absolute left-2 bottom-2 rounded-md bg-white/90 backdrop-blur-sm border border-white px-2 py-1 text-[10px] leading-tight text-slate-700 flex items-center gap-1.5">
                                <Layers className="w-3 h-3 text-blue-600" />
                                <span>{loadedCount} spectral layers merged</span>
                              </div>
                            </>
                          )}
                          {tile.kind === "heatmap" && stage >= 3 && (
                            <div className="absolute inset-0 mix-blend-multiply">
                              <div className="absolute top-[22%] left-[34%] w-16 h-16 rounded-full bg-red-500/60 blur-xl animate-pulse" />
                              <div className="absolute top-[52%] left-[22%] w-20 h-14 rounded-full bg-red-500/45 blur-xl animate-pulse" />
                              <div className="absolute top-[62%] left-[45%] w-12 h-12 rounded-full bg-red-500/45 blur-lg animate-pulse" />
                            </div>
                          )}
                          {tile.kind === "segmentation" && stage >= 4 && (
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
                        <div className="w-full h-full flex items-center justify-center text-sm text-slate-400 text-center px-3">
                          {emptyText}
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
              <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
                <h2 className="text-lg font-semibold text-slate-900">4. Results</h2>
                {fusionInfo && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200/80">
                    Combined evaluation · {fusionInfo.used}/{fusionInfo.total} spectral channels
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-1">
                  <div className="bg-slate-50 border border-slate-200/60 rounded-xl p-6 h-full">
                    <p className="text-sm uppercase tracking-wider font-semibold text-blue-600 mb-1">Combined Prediction</p>
                    <h3 className="text-3xl font-bold text-slate-800">{top.label}</h3>
                    <p className="text-lg font-medium text-slate-600 mt-1">{(top.score * 100).toFixed(2)}% Confidence</p>
                    <p className="text-xs text-slate-500 mt-3 leading-relaxed">
                      Non-polarized, polarized and UV / blue light layers were fused into a unified digital map and evaluated together.
                    </p>
                  </div>
                </div>
                <div className="md:col-span-1 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Fused ranking</p>
                  {predictions.map((p, index) => (
                    <div key={p.label} className={`flex justify-between items-center rounded-lg px-4 py-2.5 text-sm transition-colors duration-200 ${index === 0 ? "bg-blue-50 border border-blue-200/80" : "bg-slate-50"}`}>
                      <span className={`font-semibold ${index === 0 ? "text-blue-800" : "text-slate-700"}`}>{index + 1}. {p.label}</span>
                      <span className={`font-mono font-medium ${index === 0 ? "text-blue-700" : "text-slate-500"}`}>{(p.score * 100).toFixed(2)}%</span>
                    </div>
                  ))}
                </div>
                <div className="md:col-span-1 space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Per-channel evaluation</p>
                  {CHANNELS.map((ch) => {
                    const result = channelResults.find((c) => c.id === ch.id);
                    const topC = result?.top_prediction ?? null;
                    const Icon = ch.icon;
                    return (
                      <div key={ch.id} className="rounded-lg border border-slate-200/60 bg-slate-50 px-3 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${ch.badge}`}>
                            <Icon className="w-3 h-3" />
                            {ch.short} · {ch.name}
                          </span>
                          <span className="text-xs font-mono text-slate-500">{topC ? `${(topC.score * 100).toFixed(1)}%` : "–"}</span>
                        </div>
                        <p className="text-sm font-semibold text-slate-800 mt-1">
                          {topC ? topC.label : <span className="text-slate-400 font-normal">{result?.error ? "No result for this channel" : "Not evaluated"}</span>}
                        </p>
                        <p className="text-[10px] text-slate-400">{ch.detects}</p>
                        {topC && (
                          <div className="mt-1.5 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                            <div className="h-full bg-blue-500 rounded-full" style={{ width: `${clamp(topC.score * 100, 2, 100)}%` }} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-200/80 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-base font-semibold text-slate-800 mb-2 flex items-center gap-2">
                    <ClipboardList className="w-4 h-4 text-blue-600" />
                    Patient Anamnesis
                  </h4>
                  {anamnesisRows.length ? (
                    <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-sm">
                      {anamnesisRows.map((row) => (
                        <div key={row.label} className="contents">
                          <dt className="text-slate-500">{row.label}</dt>
                          <dd className="text-slate-800 font-medium break-words">{row.value}</dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="text-sm text-slate-400">No anamnesis recorded. Fill in the patient history in section 1 to include it in the report.</p>
                  )}
                </div>
                <div>
                  <h4 className="text-base font-semibold text-slate-800 mb-2">Condition Information</h4>
                  <p className="text-sm text-slate-600 leading-relaxed mb-5">{report}</p>
                  <Button onClick={handleDownloadPDF} className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-base py-3 px-6 transition-all duration-300 shadow-sm hover:shadow-md">
                    Download Report PDF
                  </Button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default Dashboard;

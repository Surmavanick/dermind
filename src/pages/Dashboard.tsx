import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import {
  AlertCircle,
  AlertTriangle,
  Aperture,
  Check,
  ClipboardList,
  FileText,
  ImagePlus,
  Layers,
  Loader2,
  LogOut,
  RotateCcw,
  ScanSearch,
  ShieldCheck,
  Sun,
  UploadCloud,
  User,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import DermioLogo from "@/components/DermioLogo";

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
  "w-full h-8 rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-clinical-blue/25 focus:border-clinical-blue transition";

const Field = ({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) => (
  <label className={`block ${className}`}>
    <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">{label}</span>
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
  <div className="mt-2.5">
    <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">{label}</span>
    <div className="flex flex-wrap gap-1">
      {options.map((opt) => {
        const on = value.includes(opt);
        return (
          <button
            type="button"
            key={opt}
            onClick={() => onToggle(opt)}
            className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors ${
              on ? "bg-clinical-blue border-clinical-blue text-white" : "bg-white border-slate-200 text-slate-600 hover:border-clinical-blue/60"
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
/* Malignancy risk banding                                             */
/* ------------------------------------------------------------------ */

const MALIGNANT_LABELS = ["Melanoma", "Basal Cell Carcinoma", "Squamous Cell Carcinoma", "Merkel Cell Carcinoma"];

const malignancyScore = (preds: Prediction[]) =>
  clamp(preds.filter((p) => MALIGNANT_LABELS.includes(p.label)).reduce((sum, p) => sum + p.score, 0), 0, 1);

type RiskTone = "red" | "amber" | "green";

const riskBand = (score: number): { label: string; tone: RiskTone; advice: string } =>
  score >= 0.5
    ? { label: "High", tone: "red", advice: "Suspicious pattern. Consider excision or specialist referral." }
    : score >= 0.2
      ? { label: "Moderate", tone: "amber", advice: "Borderline pattern. Short-interval follow-up recommended." }
      : { label: "Low", tone: "green", advice: "Inconspicuous pattern. Routine monitoring." };

const RISK_TONES: Record<RiskTone, { chip: string; bar: string; text: string; icon: LucideIcon }> = {
  red: { chip: "bg-rose-50 text-rose-700 border-rose-200", bar: "bg-rose-500", text: "text-rose-700", icon: AlertTriangle },
  amber: { chip: "bg-amber-50 text-amber-700 border-amber-200", bar: "bg-amber-500", text: "text-amber-700", icon: AlertCircle },
  green: { chip: "bg-emerald-50 text-emerald-700 border-emerald-200", bar: "bg-emerald-500", text: "text-emerald-700", icon: ShieldCheck },
};

const SectionTitle = ({ icon: Icon, title, right }: { icon: LucideIcon; title: string; right?: ReactNode }) => (
  <div className="flex items-center justify-between gap-2">
    <h2 className="text-[13px] font-semibold text-slate-900 flex items-center gap-1.5">
      <Icon className="w-3.5 h-3.5 text-clinical-blue" />
      {title}
    </h2>
    {right}
  </div>
);

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

type ViewKey = "ch1" | "ch2" | "ch3" | "fused" | "heatmap" | "segmentation";

interface ViewDef {
  key: ViewKey;
  label: string;
  caption: string;
  stageReq: number;
  src: string | null;
  channel?: ChannelDef;
}

const STAGE_VIEW: Record<number, ViewKey> = { 2: "fused", 3: "heatmap", 4: "segmentation" };
const STEP_LABELS = ["Channels", "Fusion", "Heatmap", "Segmentation"];

const Dashboard = () => {
  const navigate = useNavigate();
  const [slots, setSlots] = useState<ChannelSlot[]>([null, null, null]);
  const [fusedPreview, setFusedPreview] = useState<string | null>(null);
  const [anamnesis, setAnamnesis] = useState<Anamnesis>(EMPTY_ANAMNESIS);
  const [status, setStatus] = useState("Waiting for spectral channels.");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState(0);
  const [analysisStarted, setAnalysisStarted] = useState(false);
  const [segmentationLayers, setSegmentationLayers] = useState<SegmentationLayers | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [top, setTop] = useState<Prediction | null>(null);
  const [riskScore, setRiskScore] = useState<number | null>(null);
  const [channelResults, setChannelResults] = useState<ChannelResult[]>([]);
  const [fusionInfo, setFusionInfo] = useState<{ used: number; total: number } | null>(null);
  const [view, setView] = useState<ViewKey>("ch1");
  const [doctorId, setDoctorId] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const anamnesisRef = useRef<HTMLElement | null>(null);
  const slotsRef = useRef<ChannelSlot[]>(slots);
  const stageTimersRef = useRef<number[]>([]);
  const analysisRunRef = useRef(0);

  slotsRef.current = slots;
  const previewKey = slots.map((s) => (s ? `${s.file.name}-${s.file.size}-${s.file.lastModified}` : "empty")).join("|");
  const loadedCount = slots.filter(Boolean).length;
  const allChannelsReady = loadedCount === CHANNELS.length;
  const anamnesisRows = anamnesisEntries(anamnesis);

  useEffect(() => {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!localStorage.getItem(AUTH_KEY)) {
      window.location.href = "/doctor-login";
      return;
    }
    try {
      setDoctorId(String(JSON.parse(raw || "{}").doctorId || ""));
    } catch {
      setDoctorId("");
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

  const views: ViewDef[] = [
    ...CHANNELS.map((ch, i): ViewDef => ({
      key: `ch${ch.id}` as ViewKey,
      label: ch.name,
      caption: ch.detects,
      stageReq: 1,
      src: slots[i]?.preview ?? null,
      channel: ch,
    })),
    { key: "fused", label: "Fused map", caption: "Three spectral layers merged into one digital map", stageReq: 2, src: fusedPreview },
    { key: "heatmap", label: "Heatmap", caption: "Inflammation and vascular signal on the fused map", stageReq: 3, src: fusedPreview },
    { key: "segmentation", label: "Segmentation", caption: "Lesion zones on the fused map", stageReq: 4, src: fusedPreview },
  ];
  const isAvailable = (v: ViewDef) => Boolean(v.src) && (v.stageReq === 1 || (analysisStarted && stage >= v.stageReq));
  const activeView = views.find((v) => v.key === view) ?? views[0];
  const activeAvailable = isAvailable(activeView);

  useEffect(() => {
    if (activeAvailable) return;
    const fallback = views.find(isAvailable);
    if (fallback && fallback.key !== view) setView(fallback.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewKey, fusedPreview, stage, analysisStarted]);

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
    setRiskScore(null);
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
    setView(`ch${startIdx + 1}` as ViewKey);
    const ch = CHANNELS[startIdx];
    setStatus(entries.length > 1 ? `Loaded ${entries.length} channel images.` : `${ch.short} ${ch.name} ready.`);
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
    setRiskScore(null);
    setPredictions([]);
    setChannelResults([]);
    setFusionInfo(null);
    setView("ch1");
    setStatus("Registering spectral channels.");

    const timeline = [
      { at: 1200, stage: 1, text: "Registering 3 spectral channels." },
      { at: 3600, stage: 2, text: "Fusing layers into unified digital map." },
      { at: 6200, stage: 3, text: "Mapping inflammation and vascular signal." },
      { at: 8600, stage: 4, text: "Segmenting lesion zones." },
      { at: 10000, stage: 4, text: "Combining channel evaluations." },
    ] as const;

    timeline.forEach((entry) => {
      const timerId = window.setTimeout(() => {
        if (analysisRunRef.current !== runId) return;
        setStage(entry.stage);
        setStatus(entry.text);
        const nextView = STAGE_VIEW[entry.stage];
        if (nextView) setView(nextView);
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
      setPredictions(preds.slice(0, 6));
      setTop(topPred);
      setRiskScore(topPred ? malignancyScore(preds) : null);
      setChannelResults(payload.channels ?? []);
      setFusionInfo({ used, total });
      setStatus(topPred ? `Combined evaluation complete (${used}/${total} channels).` : "Analysis complete. No predictions returned.");
    } catch (e: unknown) {
      if (analysisRunRef.current !== runId) return;
      const message = e instanceof Error ? e.message : "Error";
      if (message === "LOCAL_API_NOT_AVAILABLE") {
        setStatus("Backend route /api/hf/analyze is not available in this environment. Deploy on Vercel or run `vercel dev`.");
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
    setView("ch1");
    setStatus("Waiting for spectral channels.");
    inputRefs.current.forEach((input) => {
      if (input) input.value = "";
    });
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_KEY);
    navigate("/doctor-login");
  };

  const focusAnamnesis = () => {
    anamnesisRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    anamnesisRef.current?.querySelector("input")?.focus();
  };

  const handleDownloadPDF = () => {
    if (!top) return;
    const desc = DISEASE_REPORTS[top.label] || `Detected: ${top.label}`;
    const date = new Date().toLocaleString();
    const band = riskScore !== null ? riskBand(riskScore) : null;
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
        <div class="section"><div class="label">Report Generated</div><div>${date}${doctorId ? ` · Doctor ${escapeHtml(doctorId)}` : ""}</div></div>
        <div class="section"><div class="label">Patient Anamnesis</div>${anamnesisHtml}</div>
        <div class="section">
          <div class="label">Combined Result</div>
          <div class="value">${escapeHtml(top.label)}</div>
          <div>Confidence: <strong>${(top.score * 100).toFixed(2)}%</strong></div>
          ${band ? `<div>Malignancy risk: <strong>${band.label}</strong> (${(riskScore! * 100).toFixed(0)}% malignant-class probability). ${escapeHtml(band.advice)}</div>` : ""}
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
  const band = riskScore !== null ? riskBand(riskScore) : null;
  const tone = band ? RISK_TONES[band.tone] : null;
  const isCurrentStageView = loading && stage === activeView.stageReq;
  const statusTone = loading ? "bg-sky-50 text-clinical-blue border-sky-200" : top ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-100 text-slate-600 border-slate-200";
  const statusLabel = loading ? "Analyzing" : top ? "Complete" : allChannelsReady ? "Ready" : "Awaiting input";

  const panel = "bg-white border border-slate-200/80 rounded-xl shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

  return (
    <div className="min-h-dvh lg:h-dvh lg:overflow-hidden bg-[#F3F6FA] text-[13px] text-slate-800 flex flex-col font-sans">
      {/* Top bar with patient banner */}
      <header className="h-12 shrink-0 bg-white border-b border-slate-200 px-3 flex items-center gap-3">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-7 h-7 rounded-md gradient-clinical text-white flex items-center justify-center">
            <DermioLogo width={16} height={16} />
          </div>
          <div className="leading-tight">
            <div className="font-display font-bold text-[13px] text-slate-900">Dermio</div>
            <div className="text-[10px] text-slate-500 -mt-0.5 hidden sm:block">Multispectral Skin Scan</div>
          </div>
        </div>
        <div className="h-6 w-px bg-slate-200 shrink-0" />
        <button type="button" onClick={focusAnamnesis} className="flex items-center gap-2 min-w-0 flex-1 text-left rounded-md px-1.5 py-1 hover:bg-slate-50 transition-colors" title="Edit patient anamnesis">
          <User className="w-4 h-4 text-slate-400 shrink-0" />
          {anamnesis.patientId.trim() ? (
            <span className="font-semibold text-slate-900 truncate">{anamnesis.patientId.trim()}</span>
          ) : (
            <span className="text-slate-400 truncate">No patient · add anamnesis</span>
          )}
          <div className="hidden md:flex items-center gap-1 min-w-0">
            {[anamnesis.age.trim() && `${anamnesis.age.trim()} y`, anamnesis.sex, anamnesis.site.trim(), anamnesis.duration.trim()]
              .filter(Boolean)
              .map((chip) => (
                <span key={chip as string} className="text-[11px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 truncate max-w-[160px]">{chip}</span>
              ))}
          </div>
        </button>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full border flex items-center gap-1 ${statusTone}`}>
            {loading && <Loader2 className="w-3 h-3 animate-spin" />}
            {statusLabel}
          </span>
          {doctorId && <span className="text-[11px] text-slate-500 hidden md:inline">Dr. {doctorId}</span>}
          <Button variant="ghost" size="sm" className="h-8 px-2 text-slate-500 hover:text-slate-900" onClick={handleLogout} title="Log out">
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      <div className="flex-1 min-h-0 p-3 grid gap-3 grid-cols-1 md:grid-cols-[264px_1fr] lg:grid-cols-[264px_1fr_288px] xl:grid-cols-[288px_1fr_312px] md:grid-rows-[auto_auto] lg:grid-rows-1">
        {/* Left: capture + anamnesis */}
        <aside className={`${panel} md:row-span-2 lg:row-span-1 lg:min-h-0 lg:overflow-y-auto dash-scroll p-3 flex flex-col gap-3`}>
          <section>
            <SectionTitle
              icon={Layers}
              title="Spectral capture"
              right={<span className={`text-[10px] px-1.5 py-0.5 rounded-full ${allChannelsReady ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{loadedCount}/{CHANNELS.length}</span>}
            />
            <div className="space-y-1.5 mt-2">
              {CHANNELS.map((ch, idx) => {
                const slot = slots[idx];
                const Icon = ch.icon;
                return (
                  <label
                    key={ch.id}
                    className={`relative flex items-center gap-2.5 rounded-lg border px-2 py-1.5 cursor-pointer group transition-colors ${
                      slot ? "border-slate-200 bg-white hover:border-clinical-blue/60" : "border-dashed border-slate-300 bg-slate-50/60 hover:border-clinical-blue hover:bg-sky-50/40"
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
                    <div className="w-10 h-10 shrink-0 rounded-md overflow-hidden bg-slate-100 border border-slate-200/80 flex items-center justify-center">
                      {slot ? <img src={slot.preview} alt={ch.name} className="w-full h-full object-cover" /> : <UploadCloud className="w-4 h-4 text-slate-400 group-hover:text-clinical-blue transition-colors" />}
                    </div>
                    <div className="min-w-0 flex-1 leading-tight">
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1 py-px rounded ${ch.badge}`}>
                          <Icon className="w-2.5 h-2.5" />
                          {ch.short.replace(" ", "")}
                        </span>
                        <span className="text-xs font-semibold text-slate-800 truncate">{ch.name}</span>
                      </div>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">{ch.detects}</p>
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
                        className="shrink-0 p-1 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    ) : (
                      <span className="shrink-0 text-[10px] text-slate-400 pr-1">Drop</span>
                    )}
                  </label>
                );
              })}
            </div>
            <div className="flex gap-2 mt-2.5">
              <Button disabled={!allChannelsReady || loading} onClick={handleAnalyze} className="flex-1 h-9 rounded-lg bg-clinical-blue hover:bg-clinical-blue/90 text-white text-[13px] font-semibold shadow-sm">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ScanSearch className="w-4 h-4" />}
                Analyze
              </Button>
              <Button variant="outline" disabled={!loadedCount && !loading} onClick={handleClear} className="h-9 w-9 p-0 rounded-lg border-slate-300 text-slate-600" title="Clear all">
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5 leading-snug">
              {allChannelsReady || loading || top ? status : "Drop one photo per channel, or all three onto Ch1."}
            </p>
          </section>

          <div className="h-px bg-slate-200" />

          <section ref={anamnesisRef}>
            <SectionTitle
              icon={ClipboardList}
              title="Patient & anamnesis"
              right={<span className={`text-[10px] px-1.5 py-0.5 rounded-full ${anamnesisRows.length ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{anamnesisRows.length ? "Recorded" : "Optional"}</span>}
            />
            <div className="grid grid-cols-[1.4fr_0.8fr_1fr] gap-2 mt-2">
              <Field label="Patient ID">
                <input className={inputClass} value={anamnesis.patientId} onChange={(e) => setAnamnesis((p) => ({ ...p, patientId: e.target.value }))} placeholder="P-0412" />
              </Field>
              <Field label="Age">
                <input className={inputClass} type="number" min={0} max={120} value={anamnesis.age} onChange={(e) => setAnamnesis((p) => ({ ...p, age: e.target.value }))} placeholder="yrs" />
              </Field>
              <Field label="Sex">
                <select className={inputClass} value={anamnesis.sex} onChange={(e) => setAnamnesis((p) => ({ ...p, sex: e.target.value }))}>
                  <option value="">–</option>
                  {SEX_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-2">
              <Field label="Lesion site">
                <input className={inputClass} value={anamnesis.site} onChange={(e) => setAnamnesis((p) => ({ ...p, site: e.target.value }))} placeholder="left forearm" />
              </Field>
              <Field label="Duration">
                <input className={inputClass} value={anamnesis.duration} onChange={(e) => setAnamnesis((p) => ({ ...p, duration: e.target.value }))} placeholder="3 weeks, growing" />
              </Field>
            </div>
            <ChipGroup label="Symptoms" options={SYMPTOM_OPTIONS} value={anamnesis.symptoms} onToggle={(opt) => toggleListValue("symptoms", opt)} />
            <ChipGroup label="Risk factors" options={RISK_OPTIONS} value={anamnesis.riskFactors} onToggle={(opt) => toggleListValue("riskFactors", opt)} />
            <Field label="Notes" className="mt-2.5">
              <textarea className={`${inputClass} h-auto py-1.5 resize-none`} rows={2} value={anamnesis.notes} onChange={(e) => setAnamnesis((p) => ({ ...p, notes: e.target.value }))} placeholder="Previous treatments, medications, relevant history" />
            </Field>
          </section>
        </aside>

        {/* Center: viewer */}
        <section className={`${panel} lg:min-h-0 flex flex-col p-3`}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5 gap-0.5">
              {views.map((v) => {
                const available = isAvailable(v);
                const selected = v.key === view;
                return (
                  <button
                    key={v.key}
                    type="button"
                    disabled={!available}
                    onClick={() => setView(v.key)}
                    className={`px-2.5 h-7 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                      selected ? "bg-white text-slate-900 shadow-sm" : available ? "text-slate-600 hover:text-slate-900" : "text-slate-400 cursor-not-allowed"
                    }`}
                  >
                    {v.channel ? v.channel.short : v.label}
                  </button>
                );
              })}
            </div>
            <ol className="flex items-center gap-1 text-[11px]">
              {STEP_LABELS.map((label, i) => {
                const n = i + 1;
                const done = top ? stage >= n : stage > n;
                const active = loading && stage === n;
                return (
                  <li key={label} className="flex items-center gap-1">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center border text-[10px] font-semibold ${
                        done ? "bg-emerald-500 border-emerald-500 text-white" : active ? "border-clinical-blue text-clinical-blue bg-sky-50" : "border-slate-300 text-slate-400 bg-white"
                      }`}
                    >
                      {done ? <Check className="w-3 h-3" /> : active ? <Loader2 className="w-3 h-3 animate-spin" /> : n}
                    </span>
                    <span className={`hidden xl:inline ${done || active ? "text-slate-700 font-medium" : "text-slate-400"}`}>{label}</span>
                    {i < STEP_LABELS.length - 1 && <span className={`w-3 h-px ${done ? "bg-emerald-400" : "bg-slate-200"}`} />}
                  </li>
                );
              })}
            </ol>
          </div>

          <div className="relative mt-2.5 h-[46vh] md:h-auto md:aspect-[4/3] lg:aspect-auto lg:flex-1 lg:min-h-0 rounded-lg bg-slate-900 overflow-hidden flex items-center justify-center">
            {activeAvailable && activeView.src ? (
              <div className="relative inline-flex max-h-full max-w-full">
                <img src={activeView.src} alt={activeView.label} className={`block max-h-full max-w-full object-contain ${activeView.key === "heatmap" ? "saturate-110 contrast-110" : ""}`} />
                {activeView.key === "fused" && (
                  <div className="absolute inset-0 pointer-events-none opacity-25 bg-[linear-gradient(to_right,rgba(255,255,255,0.6)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.6)_1px,transparent_1px)] bg-[size:24px_24px]" />
                )}
                {activeView.key === "heatmap" && stage >= 3 && (
                  <div className="absolute inset-0 mix-blend-multiply pointer-events-none">
                    <div className="absolute top-[22%] left-[34%] w-[22%] h-[28%] rounded-full bg-red-500/60 blur-xl animate-pulse" />
                    <div className="absolute top-[52%] left-[22%] w-[26%] h-[22%] rounded-full bg-red-500/45 blur-xl animate-pulse" />
                    <div className="absolute top-[62%] left-[45%] w-[16%] h-[20%] rounded-full bg-red-500/45 blur-lg animate-pulse" />
                  </div>
                )}
                {activeView.key === "segmentation" && stage >= 4 && segmentationLayers && (
                  <>
                    <img src={segmentationLayers.normalSkin} alt="" className="absolute inset-0 w-full h-full object-fill pointer-events-none opacity-50" />
                    <img src={segmentationLayers.comedones} alt="" className="absolute inset-0 w-full h-full object-fill pointer-events-none opacity-65" />
                    <img src={segmentationLayers.hyperPigmentation} alt="" className="absolute inset-0 w-full h-full object-fill pointer-events-none opacity-65" />
                    <img src={segmentationLayers.activeAcne} alt="" className="absolute inset-0 w-full h-full object-fill pointer-events-none opacity-70" />
                  </>
                )}
                {isCurrentStageView && (
                  <>
                    <div className="absolute inset-0 bg-sky-400/10 animate-pulse pointer-events-none" />
                    <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-sky-300 to-transparent animate-pulse pointer-events-none" />
                  </>
                )}
              </div>
            ) : (
              <div className="text-center px-6">
                <div className="mx-auto w-12 h-12 rounded-xl border border-dashed border-slate-600 flex items-center justify-center mb-3">
                  <ImagePlus className="w-5 h-5 text-slate-500" />
                </div>
                <p className="text-slate-300 text-sm font-medium">{activeView.src ? "Available after analysis" : "No image for this view"}</p>
                <p className="text-slate-500 text-xs mt-1">{activeView.src ? `${activeView.label} is produced at stage ${activeView.stageReq}.` : "Add the three spectral photos in the left panel."}</p>
              </div>
            )}

            {/* Viewer chrome */}
            <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5 pointer-events-none">
              {activeView.channel ? (
                <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${activeView.channel.badge}`}>
                  <activeView.channel.icon className="w-3 h-3" />
                  {activeView.channel.short} · {activeView.channel.name}
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/90 text-slate-800">
                  <Layers className="w-3 h-3 text-clinical-blue" />
                  {activeView.label}
                </span>
              )}
              <span className="text-[10px] text-slate-200/90 bg-slate-900/60 backdrop-blur-sm px-1.5 py-0.5 rounded hidden sm:inline">{activeView.caption}</span>
            </div>
            {activeView.key === "fused" && activeAvailable && (
              <span className="absolute right-2.5 bottom-2.5 text-[10px] text-slate-100 bg-slate-900/70 backdrop-blur-sm px-1.5 py-0.5 rounded pointer-events-none">{loadedCount} spectral layers merged</span>
            )}
            {activeView.key === "heatmap" && activeAvailable && stage >= 3 && (
              <div className="absolute right-2.5 bottom-2.5 flex items-center gap-1.5 text-[10px] text-slate-100 bg-slate-900/70 backdrop-blur-sm px-1.5 py-0.5 rounded pointer-events-none">
                <span>Low</span>
                <span className="w-16 h-1.5 rounded-full bg-gradient-to-r from-transparent via-orange-400 to-red-500" />
                <span>High</span>
              </div>
            )}
            {activeView.key === "segmentation" && activeAvailable && stage >= 4 && (
              <div className="absolute right-2.5 bottom-2.5 rounded bg-slate-900/70 backdrop-blur-sm px-2 py-1 text-[10px] leading-tight text-slate-100 pointer-events-none grid grid-cols-2 gap-x-3 gap-y-0.5">
                <div><span className="inline-block w-2 h-2 rounded-full bg-[#f04c35] mr-1 align-middle" />Damaged</div>
                <div><span className="inline-block w-2 h-2 rounded-full bg-[#f2da3a] mr-1 align-middle" />Comedones</div>
                <div><span className="inline-block w-2 h-2 rounded-full bg-[#9a62c9] mr-1 align-middle" />Pigmentation</div>
                <div><span className="inline-block w-2 h-2 rounded-full bg-[#8ecdf2] mr-1 align-middle" />Normal skin</div>
              </div>
            )}
            {activeView.channel && slots[activeView.channel.id - 1] && (
              <span className="absolute left-2.5 bottom-2.5 text-[10px] text-slate-300 bg-slate-900/60 px-1.5 py-0.5 rounded pointer-events-none max-w-[50%] truncate">{slots[activeView.channel.id - 1]!.file.name}</span>
            )}
          </div>

          {/* Filmstrip */}
          <div className="mt-2.5 grid grid-cols-6 gap-1.5 w-full max-w-[860px] mx-auto">
            {views.map((v) => {
              const available = isAvailable(v);
              const selected = v.key === view;
              const current = loading && stage === v.stageReq;
              return (
                <button
                  key={v.key}
                  type="button"
                  disabled={!available}
                  onClick={() => setView(v.key)}
                  className={`group text-left rounded-md border p-1 transition-all ${
                    selected ? "border-clinical-blue ring-1 ring-clinical-blue/40 bg-sky-50/40" : available ? "border-slate-200 hover:border-slate-300 bg-white" : "border-slate-200 bg-slate-50 cursor-not-allowed"
                  }`}
                >
                  <div className="relative aspect-[4/3] rounded overflow-hidden bg-slate-200">
                    {v.src ? (
                      <img src={v.src} alt="" className={`w-full h-full object-cover ${available ? "" : "opacity-40 grayscale"}`} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-400"><ImagePlus className="w-3.5 h-3.5" /></div>
                    )}
                    {current && <div className="absolute inset-0 bg-sky-400/20 animate-pulse" />}
                    {v.key === "heatmap" && available && stage >= 3 && <div className="absolute inset-0 bg-red-500/20 mix-blend-multiply" />}
                    {v.key === "segmentation" && available && stage >= 4 && <div className="absolute inset-0 bg-sky-400/20" />}
                  </div>
                  <div className="flex items-center justify-between gap-1 mt-1 px-0.5">
                    <span className={`text-[10px] font-medium truncate ${available ? "text-slate-700" : "text-slate-400"}`}>{v.channel ? `${v.channel.short} ${v.channel.name}` : v.label}</span>
                    {v.stageReq > 1 && (available ? <Check className="w-3 h-3 text-emerald-500 shrink-0" /> : <span className="text-[9px] text-slate-400 shrink-0">S{v.stageReq}</span>)}
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Right: assessment */}
        <aside className={`${panel} md:col-start-2 lg:col-start-3 lg:min-h-0 lg:overflow-y-auto dash-scroll p-3 flex flex-col gap-3`}>
          <SectionTitle icon={ScanSearch} title="AI assessment" right={fusionInfo && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-sky-50 text-clinical-blue">{fusionInfo.used}/{fusionInfo.total} channels fused</span>} />

          {!top && (
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-2.5">
              {loading ? (
                <div className="flex items-start gap-2">
                  <Loader2 className="w-4 h-4 text-clinical-blue animate-spin mt-0.5 shrink-0" />
                  <div>
                    <p className="font-semibold text-slate-800">Analyzing</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{status}</p>
                  </div>
                </div>
              ) : (
                <>
                  <p className="font-semibold text-slate-800">Awaiting analysis</p>
                  <ul className="space-y-1">
                    {CHANNELS.map((ch, i) => (
                      <li key={ch.id} className="flex items-center gap-2 text-[11px]">
                        <span className={`w-4 h-4 rounded-full flex items-center justify-center border ${slots[i] ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 text-transparent"}`}><Check className="w-2.5 h-2.5" /></span>
                        <span className={slots[i] ? "text-slate-700" : "text-slate-400"}>{ch.short} {ch.name}</span>
                      </li>
                    ))}
                    <li className="flex items-center gap-2 text-[11px]">
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center border ${anamnesisRows.length ? "bg-emerald-500 border-emerald-500 text-white" : "border-slate-300 text-transparent"}`}><Check className="w-2.5 h-2.5" /></span>
                      <span className={anamnesisRows.length ? "text-slate-700" : "text-slate-400"}>Anamnesis (optional)</span>
                    </li>
                  </ul>
                  <p className="text-[11px] text-slate-500 leading-snug">Each spectral channel is evaluated separately; the probabilities are fused into one combined result with a malignancy risk band.</p>
                  {status.startsWith("Error") || status.startsWith("Backend") ? <p className="text-[11px] text-rose-600 leading-snug">{status}</p> : null}
                </>
              )}
            </div>
          )}

          {top && band && tone && (
            <>
              <div className={`rounded-lg border p-3 ${tone.chip}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold uppercase tracking-wide opacity-80">Malignancy risk</span>
                  <tone.icon className="w-4 h-4" />
                </div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  <span className="text-2xl font-bold font-display leading-none">{band.label}</span>
                  <span className="text-xs font-medium opacity-80">{((riskScore ?? 0) * 100).toFixed(0)}% malignant-class probability</span>
                </div>
                <div className="relative mt-2.5 h-1.5 rounded-full overflow-hidden flex">
                  <span className="h-full bg-emerald-300" style={{ width: "20%" }} />
                  <span className="h-full bg-amber-300" style={{ width: "30%" }} />
                  <span className="h-full bg-rose-300" style={{ width: "50%" }} />
                  <span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full border-2 border-white shadow bg-slate-900" style={{ left: `${(riskScore ?? 0) * 100}%` }} />
                </div>
                <p className="text-[11px] mt-2 leading-snug opacity-90">{band.advice}</p>
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Combined prediction</p>
                <div className="flex items-baseline justify-between gap-2 mt-0.5">
                  <span className="text-lg font-bold text-slate-900 leading-tight">{top.label}</span>
                  <span className="font-mono text-sm font-semibold text-clinical-blue">{(top.score * 100).toFixed(1)}%</span>
                </div>
                <div className="mt-2 space-y-1.5">
                  {predictions.map((p, index) => (
                    <div key={p.label}>
                      <div className="flex justify-between text-[11px]">
                        <span className={index === 0 ? "font-semibold text-slate-800" : "text-slate-600"}>{p.label}</span>
                        <span className="font-mono text-slate-500">{(p.score * 100).toFixed(1)}%</span>
                      </div>
                      <div className="h-1 rounded-full bg-slate-100 overflow-hidden mt-0.5">
                        <div className={`h-full rounded-full ${index === 0 ? "bg-clinical-blue" : "bg-slate-300"}`} style={{ width: `${clamp(p.score * 100, 1, 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Per-channel evaluation</p>
                <div className="space-y-1.5">
                  {CHANNELS.map((ch) => {
                    const result = channelResults.find((c) => c.id === ch.id);
                    const topC = result?.top_prediction ?? null;
                    const Icon = ch.icon;
                    return (
                      <div key={ch.id} className="flex items-center gap-2">
                        <span className={`inline-flex items-center gap-0.5 text-[9px] font-bold px-1 py-px rounded shrink-0 ${ch.badge}`}>
                          <Icon className="w-2.5 h-2.5" />
                          {ch.short.replace(" ", "")}
                        </span>
                        <span className="text-[11px] text-slate-700 truncate flex-1">{topC ? topC.label : <span className="text-slate-400">{result?.error ? "No result" : "Not evaluated"}</span>}</span>
                        <span className="font-mono text-[11px] text-slate-500 shrink-0">{topC ? `${(topC.score * 100).toFixed(0)}%` : "–"}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Patient anamnesis</p>
                {anamnesisRows.length ? (
                  <dl className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 text-[11px]">
                    {anamnesisRows.map((row) => (
                      <div key={row.label} className="contents">
                        <dt className="text-slate-500">{row.label}</dt>
                        <dd className="text-slate-800 font-medium break-words">{row.value}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-[11px] text-slate-400">Not recorded.</p>
                )}
              </div>

              {report && <p className="text-[11px] text-slate-500 leading-snug">{report}</p>}

              <div className="sticky bottom-0 mt-auto -mx-3 -mb-3 px-3 py-3 bg-white border-t border-slate-100 flex gap-2">
                <Button onClick={handleDownloadPDF} className="flex-1 h-9 rounded-lg bg-clinical-blue hover:bg-clinical-blue/90 text-white text-[13px] font-semibold">
                  <FileText className="w-4 h-4" />
                  Report PDF
                </Button>
                <Button variant="outline" onClick={handleClear} className="h-9 rounded-lg border-slate-300 text-slate-600 text-[13px]">
                  New scan
                </Button>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
};

export default Dashboard;

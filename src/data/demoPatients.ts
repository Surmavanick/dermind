/**
 * Demo patients with completed multispectral scans. Used by the dashboard's
 * patient picker and "Recent scans" list so the workflow can be shown
 * end-to-end without a live capture device.
 */

export interface DemoPrediction {
  label: string;
  score: number;
}

export interface DemoChannelResult {
  id: number;
  name: string;
  predictions: DemoPrediction[];
  top_prediction: DemoPrediction | null;
}

export interface DemoAnamnesis {
  name: string;
  patientId: string;
  age: string;
  sex: string;
  site: string;
  duration: string;
  symptoms: string[];
  riskFactors: string[];
  notes: string;
}

export interface DemoPatient {
  slug: string;
  anamnesis: DemoAnamnesis;
  /** ISO timestamp of the stored scan. */
  scannedAt: string;
  doctorId: string;
  /** One image per spectral channel, in order Ch1, Ch2, Ch3. */
  photos: [string, string, string];
  predictions: DemoPrediction[];
  channels: DemoChannelResult[];
}

const channel = (id: number, name: string, label: string, score: number, runnerUp?: [string, number]): DemoChannelResult => {
  const predictions: DemoPrediction[] = [{ label, score }];
  if (runnerUp) predictions.push({ label: runnerUp[0], score: runnerUp[1] });
  return { id, name, predictions, top_prediction: predictions[0] };
};

const photos = (slug: string): [string, string, string] => [`/demo/${slug}-ch1.jpg`, `/demo/${slug}-ch2.jpg`, `/demo/${slug}-ch3.jpg`];

export const DEMO_PATIENTS: DemoPatient[] = [
  {
    slug: "melanoma",
    anamnesis: {
      name: "ნინო ბერიძე",
      patientId: "P-2026-0412",
      age: "54",
      sex: "Female",
      site: "Left forearm",
      duration: "3 weeks, slowly growing",
      symptoms: ["Itching", "Growth or change"],
      riskFactors: ["High sun exposure", "Family skin cancer"],
      notes: "Irregular border noticed by patient. No prior treatment.",
    },
    scannedAt: "2026-08-25T14:32:00",
    doctorId: "DR-1024",
    photos: photos("melanoma"),
    predictions: [
      { label: "Melanoma", score: 0.71 },
      { label: "Seborrheic Keratosis", score: 0.12 },
      { label: "Basal Cell Carcinoma", score: 0.08 },
      { label: "Warts", score: 0.04 },
      { label: "Psoriasis", score: 0.03 },
      { label: "Rosacea", score: 0.02 },
    ],
    channels: [
      channel(1, "Non-polarized", "Melanoma", 0.82, ["Seborrheic Keratosis", 0.09]),
      channel(2, "Polarized", "Melanoma", 0.77, ["Basal Cell Carcinoma", 0.11]),
      channel(3, "UV / Blue Light", "Melanoma", 0.54, ["Seborrheic Keratosis", 0.31]),
    ],
  },
  {
    slug: "bcc",
    anamnesis: {
      name: "გიორგი კაპანაძე",
      patientId: "P-2026-0387",
      age: "67",
      sex: "Male",
      site: "Nasal bridge",
      duration: "4 months, non-healing",
      symptoms: ["Bleeding", "Scaling"],
      riskFactors: ["High sun exposure", "Personal skin cancer"],
      notes: "Pearly papule with telangiectasia. Previous BCC excised 2021.",
    },
    scannedAt: "2026-08-27T10:05:00",
    doctorId: "DR-1024",
    photos: photos("bcc"),
    predictions: [
      { label: "Basal Cell Carcinoma", score: 0.63 },
      { label: "Seborrheic Keratosis", score: 0.15 },
      { label: "Melanoma", score: 0.09 },
      { label: "Warts", score: 0.06 },
      { label: "Rosacea", score: 0.04 },
      { label: "Acne Vulgaris", score: 0.03 },
    ],
    channels: [
      channel(1, "Non-polarized", "Basal Cell Carcinoma", 0.66, ["Seborrheic Keratosis", 0.18]),
      channel(2, "Polarized", "Basal Cell Carcinoma", 0.74, ["Melanoma", 0.1]),
      channel(3, "UV / Blue Light", "Basal Cell Carcinoma", 0.49, ["Warts", 0.2]),
    ],
  },
  {
    slug: "sk",
    anamnesis: {
      name: "თამარ ლომიძე",
      patientId: "P-2026-0401",
      age: "43",
      sex: "Female",
      site: "Upper back",
      duration: "1 year, stable",
      symptoms: ["Itching"],
      riskFactors: [],
      notes: "Waxy, stuck-on appearance. Patient concerned about colour change.",
    },
    scannedAt: "2026-09-01T16:40:00",
    doctorId: "DR-1024",
    photos: photos("sk"),
    predictions: [
      { label: "Seborrheic Keratosis", score: 0.58 },
      { label: "Melanoma", score: 0.24 },
      { label: "Basal Cell Carcinoma", score: 0.07 },
      { label: "Warts", score: 0.05 },
      { label: "Psoriasis", score: 0.04 },
      { label: "Rosacea", score: 0.02 },
    ],
    channels: [
      channel(1, "Non-polarized", "Seborrheic Keratosis", 0.64, ["Melanoma", 0.2]),
      channel(2, "Polarized", "Seborrheic Keratosis", 0.55, ["Melanoma", 0.3]),
      channel(3, "UV / Blue Light", "Seborrheic Keratosis", 0.55, ["Melanoma", 0.22]),
    ],
  },
  {
    slug: "psoriasis",
    anamnesis: {
      name: "მარიამ გელაშვილი",
      patientId: "P-2026-0419",
      age: "31",
      sex: "Female",
      site: "Right elbow",
      duration: "6 weeks, flaring",
      symptoms: ["Itching", "Scaling"],
      riskFactors: ["Family skin cancer"],
      notes: "Silvery scale on erythematous plaque. Topical steroid, partial response.",
    },
    scannedAt: "2026-09-04T11:50:00",
    doctorId: "DR-1024",
    photos: photos("psoriasis"),
    predictions: [
      { label: "Psoriasis", score: 0.79 },
      { label: "Atopic Dermatitis", score: 0.11 },
      { label: "Seborrheic Keratosis", score: 0.05 },
      { label: "Rosacea", score: 0.03 },
      { label: "Acne Vulgaris", score: 0.02 },
    ],
    channels: [
      channel(1, "Non-polarized", "Psoriasis", 0.83, ["Atopic Dermatitis", 0.1]),
      channel(2, "Polarized", "Psoriasis", 0.8, ["Atopic Dermatitis", 0.12]),
      channel(3, "UV / Blue Light", "Psoriasis", 0.74, ["Atopic Dermatitis", 0.11]),
    ],
  },
];

/** Newest scan first. */
export const DEMO_PATIENTS_BY_DATE = [...DEMO_PATIENTS].sort((a, b) => b.scannedAt.localeCompare(a.scannedAt));

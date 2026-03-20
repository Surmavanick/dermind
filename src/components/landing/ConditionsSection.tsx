import { motion } from "framer-motion";
import {
  Droplets, Flame, ShieldCheck, Bug, Sun, Palette, CircleDot, AlertTriangle, Scan, Eye
} from "lucide-react";

const conditions = [
  { icon: Flame, name: "Acne Vulgaris", desc: "Inflammatory and non-inflammatory acne lesion detection with severity grading.", confidence: 94 },
  { icon: Droplets, name: "Psoriasis", desc: "Plaque identification and coverage area estimation across body regions.", confidence: 91 },
  { icon: ShieldCheck, name: "Atopic Dermatitis", desc: "Eczema pattern recognition including erythema and lichenification markers.", confidence: 89 },
  { icon: Flame, name: "Rosacea", desc: "Facial erythema and papulopustular pattern classification.", confidence: 87 },
  { icon: Bug, name: "Fungal Infections", desc: "Tinea and candidal infection pattern analysis with border characterization.", confidence: 85 },
  { icon: Palette, name: "Vitiligo", desc: "Depigmentation region mapping and progression area estimation.", confidence: 92 },
  { icon: Droplets, name: "Seborrheic Dermatitis", desc: "Scaling and erythema pattern analysis in sebaceous regions.", confidence: 88 },
  { icon: ShieldCheck, name: "Contact Dermatitis", desc: "Allergic and irritant contact reaction pattern detection.", confidence: 84 },
  { icon: Sun, name: "Hyperpigmentation", desc: "Melasma, post-inflammatory hyperpigmentation, and solar lentigo analysis.", confidence: 90 },
  { icon: CircleDot, name: "Suspicious Lesions", desc: "Atypical pigmented lesion flagging with multi-feature analysis.", confidence: 93 },
  { icon: Eye, name: "Atypical Nevi", desc: "Mole morphology scoring using ABCDE criteria and dermoscopic patterns.", confidence: 91 },
  { icon: AlertTriangle, name: "Melanoma Indicators", desc: "Visual pattern-based screening for high-risk melanocytic features.", confidence: 88 },
];

const ConditionsSection = () => {
  return (
    <section className="py-16 gradient-section">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold font-display text-foreground mb-4">
            Conditions the AI <span className="text-gradient-clinical">Can Detect</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Multi-class classification covering the most prevalent dermatological conditions encountered in clinical practice.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {conditions.map((c, i) => (
            <motion.div
              key={c.name}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04 }}
              className="card-clinical rounded-xl p-5"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                  <c.icon className="h-4 w-4 text-clinical-blue" />
                </div>
                <h3 className="font-semibold font-display text-foreground text-sm leading-tight pt-1">{c.name}</h3>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">{c.desc}</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    whileInView={{ width: `${c.confidence}%` }}
                    viewport={{ once: true }}
                    transition={{ duration: 1, delay: 0.3 }}
                    className="h-full rounded-full gradient-clinical"
                  />
                </div>
                <span className="text-xs font-medium text-clinical-blue">{c.confidence}%</span>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-10 text-center"
        >
          <p className="text-sm text-muted-foreground bg-secondary/60 inline-block px-6 py-3 rounded-lg border border-border">
            ⚕️ This system provides AI-assisted screening support and does not replace professional medical diagnosis.
          </p>
        </motion.div>
      </div>
    </section>
  );
};

export default ConditionsSection;

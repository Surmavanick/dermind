import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";

const abcde = [
  { letter: "A", title: "Asymmetry", desc: "One half of the mole does not match the other in shape or color distribution." },
  { letter: "B", title: "Border Irregularity", desc: "Edges are ragged, notched, or blurred rather than smooth and well-defined." },
  { letter: "C", title: "Color Variation", desc: "Multiple shades of brown, black, red, white, or blue within a single lesion." },
  { letter: "D", title: "Diameter Estimation", desc: "Lesions larger than 6mm are flagged for additional risk factor analysis." },
  { letter: "E", title: "Evolution Indicators", desc: "Changes in size, shape, color, or symptoms detected across serial images." },
];

const MoleAnalysisSection = () => {
  return (
    <section className="py-24 bg-background">
      <div className="container mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left - Mole visual */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative"
          >
            <div className="relative aspect-square max-w-md mx-auto">
              {/* Simulated mole analysis SVG */}
              <svg viewBox="0 0 400 400" className="w-full h-full">
                <defs>
                  <radialGradient id="moleGrad" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="hsl(25, 40%, 30%)" />
                    <stop offset="60%" stopColor="hsl(20, 50%, 22%)" />
                    <stop offset="100%" stopColor="hsl(15, 45%, 18%)" />
                  </radialGradient>
                  <filter id="blur">
                    <feGaussianBlur in="SourceGraphic" stdDeviation="1" />
                  </filter>
                </defs>
                {/* Background skin */}
                <rect width="400" height="400" rx="20" fill="hsl(25, 30%, 82%)" />
                {/* Skin texture lines */}
                {Array.from({ length: 20 }).map((_, i) => (
                  <line key={`h${i}`} x1="0" y1={i * 20} x2="400" y2={i * 20} stroke="hsl(25, 20%, 75%)" strokeWidth="0.5" opacity="0.4" />
                ))}
                {/* Mole shape */}
                <ellipse cx="200" cy="200" rx="65" ry="58" fill="url(#moleGrad)" />
                <ellipse cx="210" cy="195" rx="30" ry="25" fill="hsl(15, 50%, 15%)" opacity="0.5" />
                {/* Asymmetry line */}
                <line x1="200" y1="130" x2="200" y2="270" stroke="hsl(199, 80%, 46%)" strokeWidth="2" strokeDasharray="6,4" opacity="0.8" />
                {/* Border contour */}
                <ellipse cx="200" cy="200" rx="68" ry="61" fill="none" stroke="hsl(199, 80%, 46%)" strokeWidth="2" opacity="0.7" />
                {/* Measurement arrows */}
                <line x1="130" y1="200" x2="270" y2="200" stroke="hsl(38, 92%, 50%)" strokeWidth="1.5" markerEnd="url(#arrow)" opacity="0.6" />
                <text x="190" y="185" fill="hsl(38, 92%, 50%)" fontSize="11" fontFamily="Inter">8.2mm</text>
              </svg>

              {/* Risk badge */}
              <motion.div
                animate={{ y: [0, -4, 0] }}
                transition={{ duration: 2.5, repeat: Infinity }}
                className="absolute top-4 right-4 glass-card rounded-xl px-4 py-3"
              >
                <div className="text-xs text-muted-foreground mb-1">Atypical Risk</div>
                <div className="text-2xl font-bold font-display risk-high">78%</div>
                <div className="text-xs font-medium risk-high flex items-center gap-1 mt-1">
                  <AlertTriangle className="h-3 w-3" /> Review Recommended
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* Right - ABCDE */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold font-display text-foreground mb-4">
              Advanced Pigmented Lesion{" "}
              <span className="text-gradient-clinical">Risk Assessment</span>
            </h2>
            <p className="text-muted-foreground mb-8">
              AI-driven ABCDE-based mole analysis framework for systematic evaluation of pigmented lesions.
            </p>

            <div className="space-y-4">
              {abcde.map((item, i) => (
                <motion.div
                  key={item.letter}
                  initial={{ opacity: 0, x: 10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="flex gap-4 items-start"
                >
                  <div className="w-10 h-10 rounded-lg gradient-clinical flex items-center justify-center flex-shrink-0">
                    <span className="text-primary-foreground font-bold font-display text-sm">{item.letter}</span>
                  </div>
                  <div>
                    <h4 className="font-semibold font-display text-foreground text-sm">{item.title}</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default MoleAnalysisSection;

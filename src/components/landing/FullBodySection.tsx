import { motion } from "framer-motion";

const zones = [
  { label: "Face", y: 52, x: 200 },
  { label: "Arms", y: 180, x: 110 },
  { label: "Torso", y: 175, x: 200 },
  { label: "Back", y: 200, x: 275 },
  { label: "Legs", y: 310, x: 170 },
];

const FullBodySection = () => {
  return (
    <section className="py-24 gradient-section">
      <div className="container mx-auto px-6">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold font-display text-foreground mb-4">
              Beyond Facial Analysis —{" "}
              <span className="text-gradient-clinical">Full Body Skin Intelligence</span>
            </h2>
            <p className="text-muted-foreground mb-6">
              Our model is trained on comprehensive full-body dermatological datasets covering all major anatomical regions.
            </p>

            <div className="space-y-4 mb-8">
              {["Face & Scalp", "Arms & Hands", "Back & Shoulders", "Legs & Feet", "Torso & Chest", "Close-up Dermal Lesions"].map((zone, i) => (
                <motion.div
                  key={zone}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.06 }}
                  className="flex items-center gap-3"
                >
                  <div className="w-2 h-2 rounded-full bg-clinical-cyan" />
                  <span className="text-sm text-foreground font-medium">{zone}</span>
                </motion.div>
              ))}
            </div>

            <div className="card-clinical rounded-xl p-5">
              <h4 className="font-semibold font-display text-foreground text-sm mb-2">Dataset Diversity</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Training data encompasses Fitzpatrick skin types I–VI, ensuring equitable performance across all skin tones and ethnicities. Continuous validation against diverse clinical cohorts.
              </p>
            </div>
          </motion.div>

          {/* Body silhouette SVG */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="relative max-w-sm mx-auto"
          >
            <svg viewBox="0 0 400 500" className="w-full h-full">
              {/* Simple body outline */}
              <defs>
                <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(210, 40%, 94%)" />
                  <stop offset="100%" stopColor="hsl(210, 60%, 96%)" />
                </linearGradient>
              </defs>
              {/* Head */}
              <circle cx="200" cy="55" r="30" fill="url(#bodyGrad)" stroke="hsl(210, 20%, 82%)" strokeWidth="1.5" />
              {/* Neck */}
              <rect x="190" y="85" width="20" height="20" rx="3" fill="url(#bodyGrad)" stroke="hsl(210, 20%, 82%)" strokeWidth="1.5" />
              {/* Torso */}
              <path d="M150 105 L250 105 L260 250 L140 250 Z" fill="url(#bodyGrad)" stroke="hsl(210, 20%, 82%)" strokeWidth="1.5" rx="10" />
              {/* Left arm */}
              <path d="M150 110 L110 120 L90 220 L105 225 L120 130 L150 120" fill="url(#bodyGrad)" stroke="hsl(210, 20%, 82%)" strokeWidth="1.5" />
              {/* Right arm */}
              <path d="M250 110 L290 120 L310 220 L295 225 L280 130 L250 120" fill="url(#bodyGrad)" stroke="hsl(210, 20%, 82%)" strokeWidth="1.5" />
              {/* Left leg */}
              <path d="M155 250 L145 400 L165 405 L180 255" fill="url(#bodyGrad)" stroke="hsl(210, 20%, 82%)" strokeWidth="1.5" />
              {/* Right leg */}
              <path d="M220 255 L235 405 L255 400 L245 250" fill="url(#bodyGrad)" stroke="hsl(210, 20%, 82%)" strokeWidth="1.5" />

              {/* Detection zones as glowing circles */}
              {zones.map((zone, i) => (
                <g key={zone.label}>
                  <circle cx={zone.x} cy={zone.y} r="18" fill="hsl(199, 80%, 46%)" opacity="0.12">
                    <animate attributeName="opacity" values="0.08;0.2;0.08" dur={`${2 + i * 0.3}s`} repeatCount="indefinite" />
                  </circle>
                  <circle cx={zone.x} cy={zone.y} r="10" fill="hsl(199, 80%, 46%)" opacity="0.25" />
                  <circle cx={zone.x} cy={zone.y} r="3" fill="hsl(199, 80%, 46%)" opacity="0.8" />
                </g>
              ))}
            </svg>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default FullBodySection;

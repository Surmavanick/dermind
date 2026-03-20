import { motion } from "framer-motion";
import { ScanSearch, BrainCircuit, ShieldAlert, FileText } from "lucide-react";

const features = [
  {
    icon: ScanSearch,
    title: "Lesion Detection",
    description: "Detects visible abnormalities, inflamed regions, pigmented lesions, and irregular borders using multi-scale object detection.",
  },
  {
    icon: BrainCircuit,
    title: "Disease Classification",
    description: "Classifies dermatological conditions using deep neural networks trained on multi-condition, multi-ethnicity clinical datasets.",
  },
  {
    icon: ShieldAlert,
    title: "Risk Scoring",
    description: "Generates probabilistic risk assessment for suspicious moles and atypical pigmentation patterns with confidence intervals.",
  },
  {
    icon: FileText,
    title: "Structured Report",
    description: "Outputs explainable AI-based structured diagnostic summary with visualizations for medical professional review.",
  },
];

const FeaturesSection = () => {
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
            From Image to Clinical Insight{" "}
            <span className="text-gradient-clinical">in Seconds</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Our AI pipeline transforms raw skin imagery into actionable diagnostic intelligence through four core capabilities.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="card-clinical rounded-xl p-6"
            >
              <div className="w-12 h-12 rounded-lg gradient-clinical flex items-center justify-center mb-4">
                <feature.icon className="h-6 w-6 text-primary-foreground" />
              </div>
              <h3 className="text-lg font-semibold font-display text-foreground mb-2">{feature.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;

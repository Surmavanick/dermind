import { motion } from "framer-motion";
import { Cpu, Database, Layers, RefreshCw, Lock, Shield } from "lucide-react";

const techItems = [
  { icon: Cpu, title: "Deep Convolutional Neural Networks", desc: "State-of-the-art architectures optimized for dermatological image analysis." },
  { icon: Database, title: "Multi-Condition Training Datasets", desc: "Comprehensive clinical datasets spanning 50+ dermatological conditions." },
  { icon: Layers, title: "Explainable AI Layers", desc: "Grad-CAM and attention maps provide visual explanations of model decisions." },
  { icon: RefreshCw, title: "Continuous Model Evaluation", desc: "Ongoing validation against new clinical benchmarks and edge cases." },
  { icon: Lock, title: "Privacy-First Architecture", desc: "Encrypted image processing with no data retention after analysis." },
  { icon: Shield, title: "Encrypted Cloud Inference", desc: "End-to-end encryption with secure inference infrastructure." },
];

const compliance = ["GDPR Compliance Ready", "Secure Cloud Inference", "No Image Resale Policy", "SOC 2 Aligned"];

const TechnologySection = () => {
  return (
    <section className="py-16 bg-background">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold font-display text-foreground mb-4">
            Built on Advanced AI &{" "}
            <span className="text-gradient-clinical">Clinical Validation</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Enterprise-grade technology stack designed for clinical reliability and patient safety.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {techItems.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.06 }}
              className="card-clinical rounded-xl p-6"
            >
              <item.icon className="h-8 w-8 text-clinical-blue mb-4" />
              <h3 className="font-semibold font-display text-foreground mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.desc}</p>
            </motion.div>
          ))}
        </div>

        <div className="flex flex-wrap justify-center gap-4">
          {compliance.map((item) => (
            <div key={item} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary border border-border text-sm font-medium text-secondary-foreground">
              <Shield className="h-3.5 w-3.5 text-clinical-green" />
              {item}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default TechnologySection;

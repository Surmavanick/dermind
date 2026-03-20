import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

const sections = [
  {
    title: "Upload Image for AI Skin Analysis",
    description:
      "Simply upload a clear, close-up photo of any skin concern and our AI instantly maps, scores, and reports your skin health.",
    bullets: [
      "Supports JPG and PNG formats — just select a close-up of the affected area and the analysis zone is highlighted automatically",
      "Supports dermoscope images — a clinical handheld device that captures high-resolution, polarized close-ups of the skin, revealing subsurface structures invisible to the naked eye",
      "Trained on 3M+ data points to deliver an overall skin health score with 98% diagnostic accuracy across all skin types",
    ],
    image:
      "https://i.imgur.com/BQvK8cQ.png",
  },
  {
    title: "SkinScan",
    description:
      "Real-time AI scanning that identifies skin abnormalities and detects early signs of skin disease with clinical accuracy.",
    bullets: [
      "Automatically detects and highlights skin abnormalities in uploaded images",
      "Identifies early signs of skin disease with visual confidence scoring",
      "Delivers instant, actionable insights to guide users toward the right solution",
    ],
    image:
      "https://i.imgur.com/5bTKxpj.png",
  },
  {
    title: "SkinGPT",
    description:
      "From image to clinical insight in seconds — transforming raw skin imagery into actionable diagnostic intelligence.",
    bullets: [
      "Localizes and labels specific conditions such as redness, moles, and pores",
      "Delivers annotated visual analysis with clinical-grade accuracy",
      "Generates a full skin diagnostic report from a single image in seconds",
    ],
    image:
      "https://i.imgur.com/89Xc5l1.png",
  },
];

const PipelineSection = () => {
  return (
    <section className="py-16 bg-background">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-20"
        >
          <h2 className="text-3xl md:text-4xl font-bold font-display text-foreground mb-4">
            From Image to{" "}
            <span className="text-gradient-clinical">Clinical Insight</span>
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Three AI-powered engines that analyze, detect, and diagnose skin conditions with clinical-grade precision.
          </p>
        </motion.div>

        <div className="space-y-28">
          {sections.map((section, i) => {
            const isReversed = i % 2 !== 0;
            return (
              <motion.div
                key={section.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.6 }}
                className={`grid lg:grid-cols-2 gap-12 lg:gap-20 items-center ${isReversed ? "lg:direction-rtl" : ""
                  }`}
              >
                {/* Text side */}
                <div className={`${isReversed ? "lg:order-2" : "lg:order-1"}`}>
                  <div className="bg-secondary/40 rounded-3xl p-8 md:p-10 border border-border">
                    <h3 className="text-2xl md:text-3xl font-bold font-display text-foreground mb-3">
                      {section.title}
                    </h3>
                    <p className="text-muted-foreground leading-relaxed mb-8">
                      {section.description}
                    </p>

                    <div className="space-y-5 mb-10">
                      {section.bullets.map((bullet, j) => (
                        <div key={j} className="flex items-start gap-3">
                          <div className="mt-0.5 flex-shrink-0 w-6 h-6 rounded-lg bg-clinical-blue/10 flex items-center justify-center">
                            <Sparkles className="w-3.5 h-3.5 text-clinical-blue" />
                          </div>
                          <p className="text-sm md:text-base text-foreground/80 leading-relaxed">
                            {bullet}
                          </p>
                        </div>
                      ))}
                    </div>

                    <Button className="gradient-clinical text-primary-foreground font-semibold px-8 shadow-lg hover:opacity-90 transition-opacity rounded-full">
                      Learn More
                    </Button>
                  </div>
                </div>

                {/* Image side */}
                <div
                  className={`${isReversed ? "lg:order-1" : "lg:order-2"
                    } group`}
                >
                  <div className="rounded-3xl overflow-hidden shadow-2xl border border-border">
                    <img
                      src={section.image}
                      alt={section.title}
                      className="w-full h-auto object-cover transition-transform duration-700 group-hover:scale-[1.03]"
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default PipelineSection;

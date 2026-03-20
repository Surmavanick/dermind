import { motion } from "framer-motion";
import { Video, Stethoscope, Sparkles, Smartphone, FlaskConical } from "lucide-react";

const useCases = [
  { icon: Video, title: "Telemedicine Platforms", desc: "Integrate AI-assisted dermatological screening into remote consultation workflows." },
  { icon: Stethoscope, title: "Dermatology Clinics", desc: "Augment clinical decision-making with AI-powered diagnostic support tools." },
  { icon: Sparkles, title: "Skincare Brands", desc: "Offer AI skin analysis as a premium feature for personalized product recommendations." },
  { icon: Smartphone, title: "Preventive Screening Apps", desc: "Enable consumers to monitor skin health and detect early warning signs." },
  { icon: FlaskConical, title: "Research Institutions", desc: "Accelerate dermatological research with automated image analysis at scale." },
];

const UseCasesSection = () => {
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
            Who Is This <span className="text-gradient-clinical">For?</span>
          </h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6 max-w-6xl mx-auto">
          {useCases.map((uc, i) => (
            <motion.div
              key={uc.title}
              initial={{ opacity: 0, y: 15 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="card-clinical rounded-xl p-6 text-center"
            >
              <div className="w-14 h-14 rounded-2xl gradient-clinical flex items-center justify-center mx-auto mb-4">
                <uc.icon className="h-7 w-7 text-primary-foreground" />
              </div>
              <h3 className="font-semibold font-display text-foreground text-sm mb-2">{uc.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{uc.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default UseCasesSection;

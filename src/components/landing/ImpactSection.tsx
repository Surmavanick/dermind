import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const ImpactSection = () => {
  return (
    <section className="py-16 relative overflow-hidden">
      <div className="absolute inset-0 gradient-clinical opacity-95" />
      <div className="absolute inset-0 opacity-10" style={{
        backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
        backgroundSize: '32px 32px'
      }} />

      <div className="container mx-auto px-6 relative z-10 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl md:text-5xl font-bold font-display text-primary-foreground mb-6">
            Early Detection Can Save Lives.
          </h2>
          <p className="text-lg text-primary-foreground/80 max-w-2xl mx-auto mb-10">
            AI-assisted skin screening empowers faster intervention, better monitoring, and more informed medical decisions.
          </p>
          <Button size="lg" variant="secondary" className="font-semibold px-10 text-base shadow-lg">
            Request Clinical Demo
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </motion.div>
      </div>
    </section>
  );
};

export default ImpactSection;

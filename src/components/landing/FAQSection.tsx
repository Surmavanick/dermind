import { motion } from "framer-motion";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "Is this a medical diagnosis tool?",
    a: "No. This AI system is designed for screening and educational support. It provides probabilistic assessments to assist healthcare professionals but does not replace clinical evaluation, biopsy, or dermatologist diagnosis.",
  },
  {
    q: "How accurate is the AI?",
    a: "Our models achieve 85–97% accuracy across supported conditions on validated clinical datasets. Performance varies by condition type, image quality, and skin tone. We continuously validate against independent benchmarks.",
  },
  {
    q: "Is my data secure?",
    a: "Yes. All images are encrypted in transit and at rest. We process images in isolated, secure environments and do not retain images after analysis unless explicitly authorized. Our architecture is GDPR-ready.",
  },
  {
    q: "Can it detect melanoma?",
    a: "The system identifies visual patterns associated with high-risk melanocytic lesions using ABCDE criteria analysis. It flags suspicious features for dermatologist review but does not provide melanoma diagnosis.",
  },
  {
    q: "Does it work on all skin tones?",
    a: "Yes. Our training data includes Fitzpatrick skin types I–VI, and we continuously validate equitable performance across all skin tones to minimize algorithmic bias.",
  },
  {
    q: "Is dermatologist review recommended?",
    a: "Always. AI screening is a support tool. Any concerning findings should be evaluated by a board-certified dermatologist for clinical correlation, dermoscopy, and potential biopsy.",
  },
];

const FAQSection = () => {
  return (
    <section className="py-16 bg-background">
      <div className="container mx-auto px-6 max-w-3xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold font-display text-foreground mb-4">
            Frequently Asked <span className="text-gradient-clinical">Questions</span>
          </h2>
        </motion.div>

        <Accordion type="single" collapsible className="space-y-3">
          {faqs.map((faq, i) => (
            <AccordionItem key={i} value={`item-${i}`} className="card-clinical rounded-xl px-6 border-none">
              <AccordionTrigger className="font-display font-semibold text-foreground text-left text-sm hover:no-underline py-5">
                {faq.q}
              </AccordionTrigger>
              <AccordionContent className="text-sm text-muted-foreground leading-relaxed pb-5">
                {faq.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
};

export default FAQSection;

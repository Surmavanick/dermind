import { motion } from "framer-motion";
import { ArrowRight, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/hero-skin-analysis.jpg";
import { useNavigate } from "react-router-dom";

const AUTH_KEY = "doctor_auth_session";
const DASHBOARD_URL =
  import.meta.env.VITE_DERMATOLOG_DASHBOARD_URL || "http://127.0.0.1:8080/dashboard";

const HeroSection = () => {
  const navigate = useNavigate();

  const handleRunAnalysis = () => {
    if (localStorage.getItem(AUTH_KEY)) {
      window.location.href = DASHBOARD_URL;
      return;
    }
    navigate("/doctor-login");
  };

  return (
    <section className="relative min-h-screen gradient-hero-bg overflow-hidden">
      {/* Subtle grid pattern */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'radial-gradient(hsl(var(--clinical-blue)) 1px, transparent 1px)',
        backgroundSize: '24px 24px'
      }} />

      <div className="container mx-auto px-6 pt-32 pb-20 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary text-secondary-foreground text-sm font-medium mb-6 border border-border">
              <span className="w-2 h-2 rounded-full bg-clinical-green animate-pulse-glow" />
              AI-Powered Dermatology
            </div>

            <h1 className="text-4xl md:text-5xl lg:text-[3.4rem] font-bold font-display leading-[1.1] tracking-tight text-foreground mb-6">
              AI-Powered Skin Disease Detection with{" "}
              <span className="text-gradient-clinical">Clinical Precision</span>
            </h1>

            <p className="text-lg text-muted-foreground leading-relaxed mb-4 max-w-xl">
              Advanced computer vision and deep learning technology for automated detection of dermatological conditions, lesion analysis, and mole risk assessment.
            </p>

            <p className="text-sm text-muted-foreground leading-relaxed mb-8 max-w-xl">
              Our AI analyzes facial and full-body skin images to detect patterns associated with inflammatory conditions, pigment disorders, and high-risk lesions — delivering structured diagnostic insights in seconds.
            </p>

            <div className="flex flex-wrap gap-4">
              <Button
                size="lg"
                className="gradient-clinical text-primary-foreground font-semibold px-8 shadow-lg hover:opacity-90 transition-opacity"
                onClick={handleRunAnalysis}
              >
                Run AI Analysis
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="outline" size="lg" className="font-semibold px-8">
                <Play className="mr-2 h-4 w-4" />
                See How It Works
              </Button>
            </div>
          </motion.div>

          {/* Right - Hero Image with overlays */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative"
          >
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-border">
              <img
                src={heroImage}
                alt="AI skin analysis visualization with segmentation overlays"
                className="w-full h-auto object-cover"
              />
              {/* Floating metrics */}
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-6 right-6 glass-card rounded-xl px-4 py-3 text-sm"
              >
                <div className="text-xs text-muted-foreground mb-1">Confidence</div>
                <div className="text-xl font-bold font-display text-clinical-blue">97.3%</div>
              </motion.div>

              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
                className="absolute bottom-6 left-6 glass-card rounded-xl px-4 py-3 text-sm"
              >
                <div className="text-xs text-muted-foreground mb-1">Risk Level</div>
                <div className="font-bold font-display risk-moderate">Moderate</div>
              </motion.div>

              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute bottom-6 right-6 glass-card rounded-xl px-4 py-3 text-sm"
              >
                <div className="text-xs text-muted-foreground mb-1">Condition Match</div>
                <div className="font-semibold text-foreground">Dermatitis — 89%</div>
              </motion.div>

              {/* Scanner line animation */}
              <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden mix-blend-screen">
                <motion.div
                  className="absolute left-0 right-0 w-full"
                  animate={{ y: ["-60%", "110%", "-60%"] }}
                  transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                >
                  <img
                    src="https://cdn.prod.website-files.com/6828a079f4c97e2c521a1a54/685173a8f9535d1fb351f73c_Group%2048097826.svg"
                    alt=""
                    draggable="false"
                    className="w-[150%] max-w-none ml-[-25%] opacity-90"
                  />
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;

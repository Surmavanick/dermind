import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Menu, X } from "lucide-react";

const DermindLogo = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="18" height="18">
    <path d="M4 10V4h6"/>
    <path d="M22 4h6v6"/>
    <path d="M28 22v6h-6"/>
    <path d="M10 28H4v-6"/>
    <circle cx="16" cy="15" r="7"/>
    <circle cx="13.5" cy="13.5" r="0.9" fill="currentColor" stroke="none"/>
    <circle cx="18.5" cy="13.5" r="0.9" fill="currentColor" stroke="none"/>
    <path d="M13.5 17.5c.7.6 1.6.9 2.5.9s1.8-.3 2.5-.9"/>
    <line x1="9" y1="15" x2="23" y2="15" strokeWidth="1" opacity="0.5" strokeDasharray="2 1"/>
  </svg>
);
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

const links = ["Technology", "Conditions", "Use Cases", "FAQ"];
const AUTH_KEY = "doctor_auth_session";
const DASHBOARD_URL =
  import.meta.env.VITE_DERMATOLOG_DASHBOARD_URL || "http://127.0.0.1:8080/dashboard";

const Navbar = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const openDashboardOrLogin = () => {
    if (localStorage.getItem(AUTH_KEY)) {
      window.location.href = DASHBOARD_URL;
      return;
    }
    navigate("/doctor-login");
  };

  return (
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "glass-card border-b border-border" : "bg-transparent"
        }`}
    >
      <div className="container mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg gradient-clinical flex items-center justify-center">
            <DermindLogo />
          </div>
          <span className="font-display font-bold text-foreground text-lg">Dermind</span>
        </div>

        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <a key={l} href={`#${l.toLowerCase().replace(/ /g, "-")}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium">
              {l}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Button variant="ghost" size="sm" className="font-medium" onClick={() => navigate("/doctor-login")}>
            Sign In
          </Button>
          <Button size="sm" className="gradient-clinical text-primary-foreground font-medium" onClick={openDashboardOrLogin}>
            Get Started
          </Button>
        </div>

        <button onClick={() => setOpen(!open)} className="md:hidden text-foreground">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden glass-card border-t border-border px-6 py-4 space-y-3">
          {links.map((l) => (
            <a key={l} href={`#${l.toLowerCase().replace(/ /g, "-")}`} onClick={() => setOpen(false)} className="block text-sm text-muted-foreground hover:text-foreground font-medium py-1">
              {l}
            </a>
          ))}
          <Button
            size="sm"
            className="gradient-clinical text-primary-foreground font-medium w-full mt-2"
            onClick={openDashboardOrLogin}
          >
            Get Started
          </Button>
        </div>
      )}
    </motion.nav>
  );
};

export default Navbar;

import DermioLogo from "@/components/DermioLogo";

const footerLinks = {
  Product: ["Technology", "Clinical Validation", "Pricing", "API Docs"],
  Company: ["About", "Careers", "Contact", "Blog"],
  Legal: ["Privacy Policy", "Terms of Service", "Medical Disclaimer", "GDPR"],
};

const FooterSection = () => {
  return (
    <footer className="py-16 bg-foreground">
      <div className="container mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-10 mb-12">
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg gradient-clinical flex items-center justify-center">
                <DermioLogo />
              </div>
              <span className="font-display font-bold text-background text-lg">Dermio</span>
            </div>
            <p className="text-sm text-background/50 leading-relaxed">
              AI-powered dermatological screening and risk assessment for clinical professionals.
            </p>
          </div>
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h4 className="font-display font-semibold text-background text-sm mb-4">{category}</h4>
              <ul className="space-y-2">
                {links.map((link) => (
                  <li key={link}>
                    <a href="#" className="text-sm text-background/40 hover:text-background/70 transition-colors">{link}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border-t border-background/10 pt-8">
          <p className="text-xs text-background/30 text-center max-w-3xl mx-auto leading-relaxed">
            ⚕️ This AI system is intended for screening and educational support. It is not a substitute for professional medical evaluation. Always consult a board-certified dermatologist for clinical diagnosis and treatment decisions.
          </p>
          <p className="text-xs text-background/20 text-center mt-4">
            © {new Date().getFullYear()} Dermio. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default FooterSection;

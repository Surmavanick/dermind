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
                <DermindLogo />
              </div>
              <span className="font-display font-bold text-background text-lg">Dermind</span>
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
            © {new Date().getFullYear()} Dermind. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default FooterSection;

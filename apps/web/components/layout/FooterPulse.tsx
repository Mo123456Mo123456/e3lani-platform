"use client";

import { motion } from "framer-motion";
import { usePlanetStore } from "@/lib/planet-store";
import { t } from "@/lib/i18n";

export function FooterPulse() {
  const locale = usePlanetStore((s) => s.locale);
  const dict = t(locale);

  return (
    <footer className="relative z-20 border-t border-cyan/15 bg-slate-950/50 px-4 py-2 text-center backdrop-blur-sm">
      <motion.p
        className="text-xs text-muted"
        animate={{ opacity: [0.55, 1, 0.55] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <span className="me-2 inline-block h-1.5 w-1.5 rounded-full bg-green shadow-[0_0_8px_#34d399]" />
        {dict.footer}
      </motion.p>
    </footer>
  );
}

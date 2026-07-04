"use client";

import { useEffect, useState } from "react";

const LINKS = [
  ["#manifiesto", "Firma"],
  ["#fortalezas", "Principios"],
  ["#enfoque", "Enfoque"],
  ["#confianza", "Confianza"],
];

export default function LuxNav() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > window.innerHeight * 0.85);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-all duration-700 ${
        show
          ? "translate-y-0 border-atlas-line/70 bg-atlas-bg/75 opacity-100 backdrop-blur-xl"
          : "-translate-y-full border-transparent opacity-0"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 sm:px-10">
        <a href="#top" className="text-[14px] font-medium tracking-[0.4em] text-atlas-ink">ATLAS</a>
        <div className="hidden items-center gap-9 md:flex">
          {LINKS.map(([href, label]) => (
            <a key={href} href={href} className="text-[12.5px] font-medium tracking-wide text-atlas-muted transition-colors duration-300 hover:text-atlas-ink">
              {label}
            </a>
          ))}
        </div>
        <a href="#cta" className="rounded-full border border-atlas-gold/40 px-4 py-1.5 text-[12.5px] font-medium tracking-wide text-atlas-goldsoft transition-colors duration-300 hover:bg-atlas-gold/10">
          Solicitar dossier
        </a>
      </nav>
    </header>
  );
}

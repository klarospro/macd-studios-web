"use client";

import { useEffect, useState } from "react";

const LINKS = [
  { href: "#problema", label: "El problema" },
  { href: "#solucion", label: "Solución" },
  { href: "#sistema", label: "Sistema" },
  { href: "#preservacion", label: "Preservación" },
  { href: "#rutas", label: "Socios" },
];

export default function AtlasNav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled ? "border-b border-atlas-line/70 bg-atlas-bg/80 backdrop-blur-xl" : "border-b border-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
        <a href="#top" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-atlas-teal to-atlas-blue text-sm font-black text-atlas-bg">A</span>
          <span className="text-[15px] font-semibold tracking-tight text-atlas-ink">Atlas<span className="text-atlas-teal">AI</span></span>
        </a>
        <div className="hidden items-center gap-7 md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="text-[13.5px] font-medium text-atlas-muted transition-colors hover:text-atlas-ink">
              {l.label}
            </a>
          ))}
        </div>
        <a
          href="#cta"
          className="rounded-full border border-atlas-teal/40 bg-atlas-teal/10 px-4 py-2 text-[13px] font-semibold text-atlas-teal transition-colors hover:bg-atlas-teal/20"
        >
          Hablar con Atlas
        </a>
      </nav>
    </header>
  );
}

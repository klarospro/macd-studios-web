"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

const LINKS = [
  ["#problema", "El reto"],
  ["#sistema", "El sistema"],
  ["#preservacion", "Preservación"],
  ["#rutas", "Participar"],
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
          ? "translate-y-0 border-atlas-line/70 bg-atlas-bg/80 opacity-100 backdrop-blur-xl"
          : "-translate-y-full border-transparent opacity-0"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 sm:px-10">
        <a href="#top" aria-label="ATLAS AI — Inicio" className="group flex items-center gap-2.5">
          <Image
            src="/atlas-mark-soft.png"
            alt=""
            width={40}
            height={36}
            priority
            className="h-[26px] w-auto transition-transform duration-500 ease-out group-hover:scale-105"
          />
          <span className="text-[14px] font-medium tracking-[0.38em] text-atlas-ink">ATLAS</span>
        </a>
        <div className="hidden items-center gap-9 md:flex">
          {LINKS.map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="relative text-[12.5px] font-medium tracking-wide text-atlas-muted transition-colors duration-300 hover:text-atlas-ink"
            >
              {label}
            </a>
          ))}
        </div>
        <Link
          href="/atlas/solicitud"
          className="rounded-full border border-atlas-gold/40 px-4 py-1.5 text-[12.5px] font-medium tracking-wide text-atlas-goldsoft transition-colors duration-300 hover:border-atlas-gold/70 hover:bg-atlas-gold/10"
        >
          Solicitar acceso
        </Link>
      </nav>
    </header>
  );
}

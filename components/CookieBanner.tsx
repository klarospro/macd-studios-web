"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

const STORAGE_KEY = "macd-cookie-consent";

// Paneles internos autenticados: no son contenido publico, no necesitan aviso de cookies.
const HIDDEN_PREFIXES = ["/admin", "/panel"];

export default function CookieBanner() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const accept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "accepted");
    } catch {}
    setVisible(false);
  };

  if (!visible) return null;
  if (HIDDEN_PREFIXES.some((p) => pathname?.startsWith(p))) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-50 bg-zinc-900 border border-yellow-600/30 rounded-2xl p-5 shadow-2xl">
      <p className="text-sm text-gray-300 leading-relaxed">
        Usamos cookies minimas para analitica y funcionamiento del sitio. Mas info en nuestra{" "}
        <Link href="/legal/cookies" className="text-yellow-500 hover:text-yellow-400 underline">
          politica de cookies
        </Link>
        .
      </p>
      <button
        onClick={accept}
        className="mt-4 w-full bg-yellow-500 hover:bg-yellow-400 text-black font-medium text-sm py-2.5 rounded-xl transition-colors"
      >
        Entendido
      </button>
    </div>
  );
}

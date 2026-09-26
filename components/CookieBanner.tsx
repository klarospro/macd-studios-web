"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { captureAttribution, getConsent, setConsent } from "@/lib/tracking";

// Paneles internos autenticados: no son contenido publico, no necesitan aviso de cookies.
const HIDDEN_PREFIXES = ["/admin", "/panel"];

export default function CookieBanner() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    captureAttribution();
    // localStorage solo existe en el navegador: se decide tras montar (sin desajuste de hidratación).
    const id = requestAnimationFrame(() => setVisible(getConsent() === null));
    return () => cancelAnimationFrame(id);
  }, []);

  const choose = (value: "accepted" | "rejected") => {
    setConsent(value);
    if (value === "accepted") captureAttribution();
    setVisible(false);
  };

  if (!visible) return null;
  if (HIDDEN_PREFIXES.some((p) => pathname?.startsWith(p))) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-50 bg-zinc-900 border border-yellow-600/30 rounded-2xl p-5 shadow-2xl">
      <p className="text-sm text-gray-300 leading-relaxed">
        Usamos cookies propias para que la web funcione y, si aceptas, cookies de Meta para medir nuestros anuncios.
        Más info en la{" "}
        <Link href="/legal/cookies" className="text-yellow-500 hover:text-yellow-400 underline">
          política de cookies
        </Link>
        .
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          onClick={() => choose("rejected")}
          className="border border-zinc-700 hover:border-zinc-500 text-gray-300 font-medium text-sm py-2.5 rounded-xl transition-colors"
        >
          Rechazar
        </button>
        <button
          onClick={() => choose("accepted")}
          className="bg-yellow-500 hover:bg-yellow-400 text-black font-medium text-sm py-2.5 rounded-xl transition-colors"
        >
          Aceptar
        </button>
      </div>
    </div>
  );
}

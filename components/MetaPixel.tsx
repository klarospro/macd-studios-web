"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { CONSENT_EVENT, getConsent } from "@/lib/tracking";

// Meta Pixel: solo se carga con NEXT_PUBLIC_META_PIXEL_ID y si el visitante ACEPTÓ cookies.
// El evento "Lead" lo dispara el formulario (trackLead) con el mismo event_id que manda el
// servidor por la Conversions API, para que Meta no lo cuente dos veces.
const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;

type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...a: unknown[]) => void; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

function loadPixel() {
  if (!PIXEL_ID || window.fbq) return;
  const fbq: Fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue!.push(args);
  } as Fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  window.fbq = fbq;
  window._fbq = fbq;
  const s = document.createElement("script");
  s.async = true;
  s.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(s);
  fbq("init", PIXEL_ID);
}

export function trackLead(eventId: string) {
  if (window.fbq && getConsent() === "accepted") window.fbq("track", "Lead", {}, { eventID: eventId });
}

export default function MetaPixel() {
  const pathname = usePathname();

  useEffect(() => {
    const start = () => {
      if (getConsent() !== "accepted" || pathname?.startsWith("/admin") || pathname?.startsWith("/panel")) return;
      loadPixel();
      window.fbq?.("track", "PageView");
    };
    start();
    window.addEventListener(CONSENT_EVENT, start);
    return () => window.removeEventListener(CONSENT_EVENT, start);
  }, [pathname]);

  return null;
}

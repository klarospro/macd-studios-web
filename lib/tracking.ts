// Consentimiento de cookies + atribución de campañas (solo navegador).
//
// - Consentimiento: "accepted" | "rejected". Solo con "accepted" se carga el Meta Pixel
//   (cookies de publicidad de terceros requieren opt-in en la UE).
// - Atribución: primer origen del visitante (UTM + fbclid + página de entrada), 30 días.
//   Solo se GUARDA en el navegador con consentimiento. Sin consentimiento se lee de la URL
//   actual en el momento de enviar el formulario (sin almacenar nada).

// v2: el banner antiguo ("Entendido") no pedía consentimiento para publicidad → se vuelve a preguntar.
export const CONSENT_KEY = "macd-cookie-consent-v2";
export const CONSENT_EVENT = "macd-consent";
const ATTR_KEY = "macd-attribution";
const ATTR_DAYS = 30;
const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;

export type Attribution = Partial<Record<(typeof UTM_KEYS)[number] | "fbclid" | "landing" | "referrer", string>>;

export function getConsent(): "accepted" | "rejected" | null {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === "accepted" || v === "rejected" ? v : null;
  } catch {
    return null;
  }
}

export function setConsent(value: "accepted" | "rejected") {
  try {
    localStorage.setItem(CONSENT_KEY, value);
  } catch {}
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
}

function fromUrl(): Attribution {
  const params = new URLSearchParams(window.location.search);
  const out: Attribution = {};
  for (const k of UTM_KEYS) {
    const v = params.get(k);
    if (v) out[k] = v.slice(0, 120);
  }
  const fbclid = params.get("fbclid");
  if (fbclid) out.fbclid = fbclid.slice(0, 300);
  return out;
}

export function captureAttribution() {
  if (getConsent() !== "accepted") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const fresh: Attribution = {};
    for (const k of UTM_KEYS) {
      const v = params.get(k);
      if (v) fresh[k] = v.slice(0, 120);
    }
    const fbclid = params.get("fbclid");
    if (fbclid) fresh.fbclid = fbclid.slice(0, 300);

    const stored = localStorage.getItem(ATTR_KEY);
    const prev = stored ? (JSON.parse(stored) as { at: number; data: Attribution }) : null;
    const expired = !prev || Date.now() - prev.at > ATTR_DAYS * 86400_000;

    // Primer contacto gana, salvo que llegue una campaña nueva o el anterior haya caducado.
    if (expired || Object.keys(fresh).length) {
      const data: Attribution = {
        ...fresh,
        landing: window.location.pathname,
        referrer: document.referrer ? new URL(document.referrer).hostname : undefined,
      };
      localStorage.setItem(ATTR_KEY, JSON.stringify({ at: Date.now(), data }));
    }
  } catch {}
}

export function getAttribution(): Attribution {
  try {
    const stored = getConsent() === "accepted" ? localStorage.getItem(ATTR_KEY) : null;
    if (stored) return JSON.parse(stored).data as Attribution;
  } catch {}
  return { ...fromUrl(), landing: window.location.pathname };
}

// Cookies del Pixel que Meta usa para cruzar el evento del navegador con el del servidor.
export function getMetaCookies() {
  const read = (name: string) => document.cookie.split("; ").find((c) => c.startsWith(`${name}=`))?.split("=")[1];
  return { fbp: read("_fbp"), fbc: read("_fbc") };
}

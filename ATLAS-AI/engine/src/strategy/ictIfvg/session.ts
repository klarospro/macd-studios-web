/**
 * Ventana horaria de la sesión (01_REGLAS_ENTRADA.md §4): 9:30-10:10 AM hora de Nueva York.
 * Usa `Intl.DateTimeFormat` (built-in de Node, NO es una dependencia npm nueva) con la base de
 * datos IANA de zonas horarias para manejar DST correctamente, sin librerías adicionales.
 */

const NY_TZ = "America/New_York";

export const SESSION_START_MINUTES = 9 * 60 + 30; // 09:30
export const SESSION_END_MINUTES = 10 * 60 + 10; // 10:10

export interface NyTime {
  hour: number;
  minute: number;
  /** "Mon".."Sun" en inglés (locale en-US). */
  weekday: string;
}

/** Convierte un epoch en segundos (UTC) a hora local de Nueva York. */
export function toNyTime(epochSeconds: number): NyTime {
  const date = new Date(epochSeconds * 1000);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: NY_TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  }).formatToParts(date);

  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? "";
  // Node/ICU con hour12:false puede devolver "24" para la medianoche en vez de "00" — se normaliza.
  const hourRaw = Number(get("hour"));
  const hour = hourRaw === 24 ? 0 : hourRaw;

  return { hour, minute: Number(get("minute")), weekday: get("weekday") };
}

/** true si el epoch cae dentro de la ventana 9:30-10:10 NY (ambos extremos inclusive). */
export function isInFirstIfvgWindow(epochSeconds: number): boolean {
  const { hour, minute } = toNyTime(epochSeconds);
  const totalMinutes = hour * 60 + minute;
  return totalMinutes >= SESSION_START_MINUTES && totalMinutes <= SESSION_END_MINUTES;
}

/** true si el epoch cae en día hábil (lunes-viernes) en hora de Nueva York. */
export function isWeekday(epochSeconds: number): boolean {
  const { weekday } = toNyTime(epochSeconds);
  return weekday !== "Sat" && weekday !== "Sun";
}

const nyDayFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: NY_TZ, year: "numeric", month: "2-digit", day: "2-digit" });

/** Clave de día natural en zona horaria de Nueva York ("YYYY-MM-DD"), comparable lexicográficamente. */
export function nyDayKey(epochSeconds: number): string {
  return nyDayFormatter.format(new Date(epochSeconds * 1000));
}

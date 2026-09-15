import { HONEYPOT_FIELD } from "@/lib/antiSpam";

/** Campo trampa invisible para bots: los usuarios reales nunca lo completan. */
export default function Honeypot() {
  return (
    <input
      type="text"
      name={HONEYPOT_FIELD}
      tabIndex={-1}
      autoComplete="off"
      aria-hidden="true"
      style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px", opacity: 0 }}
    />
  );
}

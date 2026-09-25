"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { SearchCheck } from "lucide-react";
import Honeypot from "@/components/Honeypot";
import { HONEYPOT_FIELD } from "@/lib/antiSpam";

const SECTORES = ["Inmobiliaria", "Restaurante", "Clínica / salud", "Iglesia / organización", "Otro"];

const CONTACTOS = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "llamada", label: "Llamada" },
  { value: "email", label: "Email" },
] as const;

type Contacto = (typeof CONTACTOS)[number]["value"];

const inputClass =
  "bg-[#0d0d0d] border border-[#333] rounded-lg px-4 py-3 text-white text-sm placeholder-zinc-700 focus:outline-none focus:border-yellow-500/50";

export default function OfertasSignup() {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [sector, setSector] = useState("");
  const [contacto, setContacto] = useState<Contacto>("whatsapp");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const formRef = useRef<HTMLFormElement>(null);

  const necesitaTelefono = contacto !== "email";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !email.trim()) return;
    if (necesitaTelefono && !telefono.trim()) return;
    setStatus("loading");

    const honeypot = new FormData(formRef.current ?? undefined).get(HONEYPOT_FIELD);

    const res = await fetch("/api/offer-signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, email, telefono, sector, contacto, [HONEYPOT_FIELD]: honeypot }),
    });

    setStatus(res.ok ? "done" : "error");
  }

  return (
    <section id="auditoria" className="py-24 relative">
      <div className="max-w-2xl mx-auto px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-gradient-to-br from-white/5 to-transparent border border-yellow-600/20 rounded-3xl p-8 md:p-10 text-center"
        >
          <SearchCheck className="w-10 h-10 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-3xl lg:text-4xl font-bold mb-3">
            Auditoría <span className="text-gold-gradient italic">gratis</span>
          </h2>
          <p className="text-gray-400 max-w-md mx-auto mb-8">
            Descubre cuántos clientes pierdes por contestar tarde. Estudiamos tu caso, te mostramos dónde se te
            escapan las ventas y agendamos una llamada para enseñarte cómo taparlo.
          </p>

          {status === "done" ? (
            <p className="text-yellow-500 font-semibold">
              ¡Recibido! Te enviamos un correo de confirmación y te contactamos para agendar la llamada.
            </p>
          ) : (
            <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-sm mx-auto">
              <Honeypot />
              <input
                type="text"
                placeholder="Tu nombre"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className={inputClass}
              />
              <input
                type="email"
                placeholder="Tu email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
              />
              <select
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                className={`${inputClass} ${sector ? "" : "text-zinc-700"}`}
              >
                <option value="">Tipo de negocio</option>
                {SECTORES.map((s) => (
                  <option key={s} value={s} className="text-white">
                    {s}
                  </option>
                ))}
              </select>

              <fieldset className="text-left">
                <legend className="text-xs text-gray-400 mb-2">¿Cómo prefieres que te contactemos?</legend>
                <div className="grid grid-cols-3 gap-2">
                  {CONTACTOS.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setContacto(c.value)}
                      aria-pressed={contacto === c.value}
                      className={`py-2 rounded-lg text-sm border transition-colors ${
                        contacto === c.value
                          ? "border-yellow-500 bg-yellow-600/15 text-yellow-400"
                          : "border-[#333] text-gray-400 hover:border-yellow-600/40"
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <input
                type="tel"
                placeholder={necesitaTelefono ? "WhatsApp con prefijo (+34…)" : "WhatsApp con prefijo (opcional)"}
                required={necesitaTelefono}
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className={inputClass}
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="bg-gold-gradient text-black font-bold py-3 rounded-lg hover:scale-[1.02] transition-transform disabled:opacity-50"
              >
                {status === "loading" ? "Enviando..." : "Quiero mi auditoría gratis"}
              </button>
              {status === "error" && (
                <p className="text-red-400 text-xs text-center">Algo falló. Intenta de nuevo.</p>
              )}
              <p className="text-zinc-700 text-xs text-center">Sin compromiso. Sin spam.</p>
            </form>
          )}
        </motion.div>
      </div>
    </section>
  );
}

"use client";

import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

const WHATSAPP_URL = "https://wa.me/34623474706";

// Este boton es de la marca MACD Studios: no debe mostrarse en el
// panel admin, el panel interno ni en el sitio de Atlas (marca propia
// separada con su propio sistema de contacto).
const HIDDEN_PREFIXES = ["/admin", "/panel", "/atlas", "/pay"];

export default function WhatsAppButton() {
  const pathname = usePathname();
  if (HIDDEN_PREFIXES.some((p) => pathname?.startsWith(p))) return null;

  return (
    <motion.a
      href={WHATSAPP_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chatear por WhatsApp"
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 1, type: "spring", stiffness: 200 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      className="fixed bottom-4 left-4 z-40 w-14 h-14 bg-[#25D366] rounded-full shadow-2xl flex items-center justify-center"
    >
      <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-40" />
      <svg viewBox="0 0 24 24" className="relative w-7 h-7 fill-white">
        <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.822 9.822 0 0 0 12.04 2Zm0 1.67c2.2 0 4.27.86 5.82 2.41a8.183 8.183 0 0 1 2.41 5.83c0 4.55-3.7 8.25-8.25 8.25a8.28 8.28 0 0 1-4.2-1.15l-.3-.18-3.12.82.83-3.04-.19-.31a8.24 8.24 0 0 1-1.26-4.39c0-4.55 3.7-8.24 8.26-8.24Zm-4.52 4.27c-.16 0-.42.06-.64.31-.22.24-.85.83-.85 2.03 0 1.19.87 2.35.99 2.51.12.16 1.69 2.72 4.19 3.71.58.25 1.03.4 1.39.51.58.19 1.11.16 1.53.1.47-.07 1.43-.58 1.63-1.15.2-.56.2-1.04.14-1.15-.06-.1-.22-.16-.46-.28-.24-.12-1.43-.71-1.66-.79-.22-.08-.38-.12-.55.12-.16.24-.62.79-.77.95-.14.16-.28.18-.52.06-.24-.12-1.02-.38-1.95-1.21-.72-.64-1.2-1.44-1.35-1.68-.14-.24-.02-.37.11-.5.11-.11.24-.28.36-.42.12-.14.16-.24.24-.4.08-.16.04-.31-.02-.43-.06-.12-.55-1.35-.76-1.84-.2-.48-.4-.42-.55-.42Z" />
      </svg>
    </motion.a>
  );
}

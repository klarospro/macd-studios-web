"use client";

import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Send } from "lucide-react";

const TELEGRAM_URL = "https://t.me/macdstudios";

// Igual que WhatsAppButton: no se muestra en admin/panel/atlas/pay.
const HIDDEN_PREFIXES = ["/admin", "/panel", "/atlas", "/pay"];

export default function TelegramButton() {
  const pathname = usePathname();
  if (HIDDEN_PREFIXES.some((p) => pathname?.startsWith(p))) return null;

  return (
    <motion.a
      href={TELEGRAM_URL}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chatear por Telegram"
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 1.15, type: "spring", stiffness: 200 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      className="fixed bottom-[84px] left-4 z-40 w-14 h-14 bg-[#229ED9] rounded-full shadow-2xl flex items-center justify-center"
    >
      <Send className="w-6 h-6 text-white -translate-x-0.5 translate-y-0.5" fill="white" />
    </motion.a>
  );
}

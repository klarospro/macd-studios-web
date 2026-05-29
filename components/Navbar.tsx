"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Menu, X, Send } from "lucide-react";
import Image from "next/image";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6 }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-black/90 backdrop-blur-xl border-b border-yellow-600/20" : "bg-transparent"}`}
    >
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <a href="#" className="flex items-center gap-3">
            <Image src="/images/logo.png" alt="MACD Studios" width={160} height={50} className="h-12 w-auto object-contain" priority />
          </a>

          <div className="hidden lg:flex items-center gap-8">
            <a href="#servicios" className="text-gray-300 hover:text-yellow-500 font-medium transition-colors">Servicios</a>
            <a href="#trabajos" className="text-gray-300 hover:text-yellow-500 font-medium transition-colors">Trabajos</a>
            <a href="#planes" className="text-gray-300 hover:text-yellow-500 font-medium transition-colors">Planes</a>
            <a href="#contacto" className="text-gray-300 hover:text-yellow-500 font-medium transition-colors">Contacto</a>
          </div>

          <a
            href="https://t.me/macdstudios"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden lg:inline-flex items-center gap-2 bg-gold-gradient text-black font-bold px-6 py-3 rounded-full hover:scale-105 transition-transform"
          >
            <Send className="w-4 h-4" />
            Cotizar ahora
          </a>

          <button onClick={() => setMobileOpen(!mobileOpen)} className="lg:hidden text-white p-2">
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:hidden py-6 border-t border-yellow-600/20"
          >
            <div className="flex flex-col gap-4">
              <a href="#servicios" onClick={() => setMobileOpen(false)} className="text-gray-300 hover:text-yellow-500 py-2">Servicios</a>
              <a href="#trabajos" onClick={() => setMobileOpen(false)} className="text-gray-300 hover:text-yellow-500 py-2">Trabajos</a>
              <a href="#planes" onClick={() => setMobileOpen(false)} className="text-gray-300 hover:text-yellow-500 py-2">Planes</a>
              <a href="#contacto" onClick={() => setMobileOpen(false)} className="text-gray-300 hover:text-yellow-500 py-2">Contacto</a>
              <a href="https://t.me/macdstudios" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 bg-gold-gradient text-black font-bold px-6 py-3 rounded-full mt-2">
                <Send className="w-4 h-4" />
                Cotizar ahora
              </a>
            </div>
          </motion.div>
        )}
      </div>
    </motion.nav>
  );
}

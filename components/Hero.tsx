"use client";

import { motion } from "framer-motion";
import { MessageCircle, ArrowRight, Sparkles } from "lucide-react";
import Image from "next/image";
import { PEDIR_PRESUPUESTO_URL } from "@/lib/contacto";

export default function Hero() {
  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      <div className="absolute inset-0 z-0">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="w-full h-full object-cover"
        >
          <source src="/videos/hero-bg.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-black/70"></div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black"></div>
      </div>

      <div className="relative max-w-7xl mx-auto px-6 lg:px-8 py-32 text-center z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8 }}
          className="flex justify-center mb-8"
        >
          <Image src="/images/logo.png" alt="MACD Studios" width={280} height={90} className="h-24 w-auto object-contain" priority />
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="inline-flex items-center gap-2 bg-yellow-600/10 border border-yellow-600/30 text-yellow-500 px-4 py-2 rounded-full text-sm font-medium mb-8 backdrop-blur-sm"
        >
          <Sparkles className="w-4 h-4" />
          CRM · Automatización · IA
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-8 leading-tight"
        >
          Sistemas a medida<br />
          <span className="text-gold-gradient italic">que trabajan por ti.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-xl text-gray-300 mb-12 max-w-2xl mx-auto leading-relaxed"
        >
          Webs, CRM, bots con IA y automatizaciones para restaurantes, clínicas,
          inmobiliarias y cualquier negocio que quiera dejar de hacerlo todo a mano.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="flex flex-col sm:flex-row gap-4 justify-center mb-16"
        >
          <motion.a
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            href={PEDIR_PRESUPUESTO_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center justify-center gap-2 bg-gold-gradient text-black font-bold px-8 py-4 rounded-full"
          >
            <MessageCircle className="w-5 h-5" />
            Pedir presupuesto
          </motion.a>

          <motion.a
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            href="#trabajos"
            className="group inline-flex items-center justify-center gap-2 bg-white/10 border border-yellow-600/30 text-white font-semibold px-8 py-4 rounded-full hover:bg-white/20 transition-colors backdrop-blur-sm"
          >
            Ver proyectos
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </motion.a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="flex flex-wrap justify-center gap-8 lg:gap-16"
        >
          <div className="text-center">
            <div className="text-4xl font-bold text-gold-gradient">1-2 semanas</div>
            <div className="text-sm text-gray-400 mt-1">De la idea al sistema funcionando</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-gold-gradient">24/7</div>
            <div className="text-sm text-gray-400 mt-1">Atención con IA</div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-gold-gradient">A medida</div>
            <div className="text-sm text-gray-400 mt-1">Hecho para tu negocio, no de catálogo</div>
          </div>
        </motion.div>
      </div>

      <motion.div
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
      >
        <div className="w-6 h-10 border-2 border-yellow-600/50 rounded-full flex justify-center pt-2">
          <div className="w-1 h-2 bg-yellow-500 rounded-full"></div>
        </div>
      </motion.div>
    </section>
  );
}

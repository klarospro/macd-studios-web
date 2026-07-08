"use client";

import Image from "next/image";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import {
  motion,
  useInView,
  useReducedMotion,
  useScroll,
  useTransform,
  type Variants,
} from "framer-motion";

// Curva "de cámara": salida exponencial, lenta y refinada.
const CINE = [0.19, 1, 0.22, 1] as const;

/** Revelado cinematográfico: fade + blur reveal + slide lento. La microtransición firma de ATLAS. */
export function BlurReveal({
  children,
  delay = 0,
  y = 28,
  className,
  duration = 1.1,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
  duration?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: reduce ? 0 : y, filter: reduce ? "none" : "blur(14px)" }}
      whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration, delay, ease: CINE }}
    >
      {children}
    </motion.div>
  );
}

/**
 * Titular con revelado por palabras (blur + rise escalonado).
 * Marca acentos con **texto**: se ponen en itálica y color de acento.
 * Detección robusta: cualquier palabra que contenga `**` se acentúa y se le
 * quitan los marcadores, aunque lleve puntuación pegada (p.ej. `**siglo**.`).
 */
export function Words({
  text,
  className,
  delay = 0,
  stagger = 0.09,
}: {
  text: string;
  className?: string;
  delay?: number;
  stagger?: number;
}) {
  const reduce = useReducedMotion();
  const container: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reduce ? 0 : stagger, delayChildren: delay } },
  };
  const child: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : "0.45em", filter: reduce ? "none" : "blur(10px)" },
    show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.95, ease: CINE } },
  };
  const words = text.split(" ");
  return (
    <motion.span
      className={className}
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      aria-label={text.replace(/\*\*/g, "")}
    >
      {words.map((w, i) => {
        const em = w.includes("**");
        const clean = w.replace(/\*\*/g, "");
        const last = i === words.length - 1;
        return (
          <Fragment key={i}>
            <span className={`inline-block ${last ? "" : "mr-[0.24em]"}`}>
              <motion.span variants={child} aria-hidden className={`inline-block ${em ? "italic text-atlas-gold" : ""}`}>
                {clean}
              </motion.span>
            </span>
          </Fragment>
        );
      })}
    </motion.span>
  );
}

/** Capa con parallax vertical ligado al scroll (capas a distinta velocidad). */
export function Parallax({
  children,
  speed = 0.3,
  className,
}: {
  children: ReactNode;
  speed?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], reduce ? ["0px", "0px"] : [`${speed * 90}px`, `${-speed * 90}px`]);
  return (
    <motion.div ref={ref} style={{ y }} className={className}>
      {children}
    </motion.div>
  );
}

/** Imagen de fondo con zoom lento + parallax al hacer scroll (sensación de cámara). */
export function CinemaImage({
  src,
  alt = "",
  priority = false,
  className = "",
  overlay,
}: {
  src: string;
  alt?: string;
  priority?: boolean;
  className?: string;
  overlay?: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const scale = useTransform(scrollYProgress, [0, 1], reduce ? [1, 1] : [1.2, 1.02]);
  const y = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["-3%", "3%"]);
  return (
    <div ref={ref} className={`absolute inset-0 overflow-hidden ${className}`}>
      <motion.div style={{ scale, y }} className="absolute -inset-[6%]">
        <Image src={src} alt={alt} fill priority={priority} sizes="100vw" className="object-cover" />
      </motion.div>
      {overlay}
    </div>
  );
}

/** Número grande con count-up al entrar en viewport (aparición secuencial refinada). */
export function CountUp({
  to,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
  duration = 2,
}: {
  to: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  const reduce = useReducedMotion();
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    if (reduce) { setVal(to); return; }
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / (duration * 1000), 1);
      setVal(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, to, reduce, duration]);
  return (
    <span ref={ref} className={className}>
      {prefix}
      {val.toFixed(decimals)}
      {suffix}
    </span>
  );
}

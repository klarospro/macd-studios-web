import type { Metadata } from "next";
import { Playfair_Display, Inter, JetBrains_Mono, Fraunces } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

// Atlas — serif display de alto contraste (Fraunces), con itálica para acentos editoriales.
const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["400", "500", "600", "700", "900"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MACD STUDIOS - Automatizacion con IA para tu negocio",
  description: "Webs premium, bots 24/7 con IA y sistemas que venden. Automatizamos clinicas, restaurantes e inmobiliarias en Espana.",
  keywords: ["automatizacion", "IA", "bots", "web", "Espana", "negocios"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${playfair.variable} ${inter.variable} ${jetbrains.variable} ${fraunces.variable}`}>
      <body>{children}</body>
    </html>
  );
}

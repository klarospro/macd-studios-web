import type { Metadata } from "next";
import { Playfair_Display, Inter, JetBrains_Mono, Fraunces } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import CookieBanner from "@/components/CookieBanner";
import WhatsAppButton from "@/components/WhatsAppButton";
import TelegramButton from "@/components/TelegramButton";
import "./globals.css";

const SITE_URL = "https://macdestudios.com";

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
  metadataBase: new URL(SITE_URL),
  title: {
    default: "MACD Studios - Automatizacion con IA para tu negocio",
    template: "%s | MACD Studios",
  },
  description: "Webs premium, bots 24/7 con IA y sistemas que venden. Automatizamos clinicas, restaurantes, inmobiliarias y comunidades en Espana.",
  keywords: ["automatizacion", "IA", "bots WhatsApp", "diseno web", "Espana", "negocios"],
  authors: [{ name: "MACD Studios" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "es_ES",
    url: SITE_URL,
    siteName: "MACD Studios",
    title: "MACD Studios - Automatizacion con IA para tu negocio",
    description: "Webs premium, bots 24/7 con IA y sistemas que venden. Automatizamos clinicas, restaurantes, inmobiliarias y comunidades en Espana.",
    images: [{ url: "/images/logo.png", width: 1200, height: 630, alt: "MACD Studios" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "MACD Studios - Automatizacion con IA para tu negocio",
    description: "Webs premium, bots 24/7 con IA y sistemas que venden.",
    images: ["/images/logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
};

const organizationJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "MACD Studios",
  legalName: "MACD Studios LLC",
  url: SITE_URL,
  logo: `${SITE_URL}/images/logo.png`,
  email: "hola@macdestudios.com",
  sameAs: [
    "https://t.me/macdstudios",
    "https://www.instagram.com/macd_studios14",
  ],
  areaServed: "ES",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${playfair.variable} ${inter.variable} ${jetbrains.variable} ${fraunces.variable}`}>
      <body>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        {children}
        <CookieBanner />
        <WhatsAppButton />
        <TelegramButton />
        <Analytics />
      </body>
    </html>
  );
}

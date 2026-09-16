import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Politica de Cookies" };

export default function CookiesPage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-24">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-yellow-500 hover:text-yellow-400 text-sm mb-10 inline-block">
          ← Volver al inicio
        </Link>
        <h1 className="text-4xl font-bold mb-10">Politica de Cookies</h1>

        <div className="prose prose-invert prose-yellow max-w-none space-y-8 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-white mb-2">1. Que son las cookies</h2>
            <p>
              Las cookies son pequenos archivos que se almacenan en tu navegador al visitar un
              sitio web. Este sitio (macdestudios.com), operado por MACD Studios LLC, utiliza un
              numero minimo de cookies y tecnologias similares.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-2">2. Que cookies utilizamos</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>
                <strong>Analiticas (Vercel Analytics):</strong> miden visitas y rendimiento de
                forma agregada y anonimizada, sin usar cookies de seguimiento entre sitios.
              </li>
              <li>
                <strong>Funcionales:</strong> necesarias para recordar tu eleccion sobre esta
                misma politica de cookies.
              </li>
            </ul>
            <p className="mt-2">No utilizamos cookies de publicidad de terceros.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-2">3. Como gestionar las cookies</h2>
            <p>
              Puedes eliminar o bloquear las cookies desde la configuracion de tu navegador. Ten
              en cuenta que bloquear cookies funcionales puede afectar al funcionamiento normal
              del sitio.
            </p>
          </section>

          <p className="text-sm text-gray-500 pt-4 border-t border-white/10">
            Ultima actualizacion: septiembre 2026.
          </p>
        </div>
      </div>
    </main>
  );
}

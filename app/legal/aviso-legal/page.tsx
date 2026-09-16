import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Aviso Legal" };

export default function AvisoLegalPage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-24">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-yellow-500 hover:text-yellow-400 text-sm mb-10 inline-block">
          ← Volver al inicio
        </Link>
        <h1 className="text-4xl font-bold mb-10">Aviso Legal</h1>

        <div className="prose prose-invert prose-yellow max-w-none space-y-8 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-white mb-2">1. Titular del sitio</h2>
            <p>
              Este sitio web (macdestudios.com) es operado por <strong>MACD Studios LLC</strong>,
              sociedad constituida en el Estado de Wyoming, Estados Unidos (EIN 30-1502570).
              Para cualquier consulta, contacto en{" "}
              <a href="mailto:hola@macdestudios.com" className="text-yellow-500 hover:text-yellow-400">
                hola@macdestudios.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-2">2. Objeto</h2>
            <p>
              MACD Studios LLC ofrece servicios de diseno y desarrollo web, automatizacion con
              inteligencia artificial (bots, asistentes conversacionales, sistemas de notificacion)
              y consultoria tecnologica para negocios.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-2">3. Condiciones de uso</h2>
            <p>
              El acceso y uso de este sitio atribuye la condicion de usuario e implica la
              aceptacion de las condiciones aqui recogidas. El usuario se compromete a hacer un
              uso adecuado de los contenidos y servicios ofrecidos, y a no emplearlos para
              actividades ilicitas o contrarias a la buena fe y al orden publico.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-2">4. Propiedad intelectual</h2>
            <p>
              Los contenidos de este sitio (textos, imagenes, disenos, codigo, marca) son
              propiedad de MACD Studios LLC o de terceros que han autorizado su uso, y estan
              protegidos por la normativa de propiedad intelectual e industrial aplicable. Queda
              prohibida su reproduccion total o parcial sin autorizacion expresa.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-2">5. Limitacion de responsabilidad</h2>
            <p>
              MACD Studios LLC no garantiza la disponibilidad continua del sitio ni se hace
              responsable de danos derivados de interrupciones, virus o fallos tecnicos ajenos a
              su control razonable.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-2">6. Legislacion aplicable</h2>
            <p>
              Estas condiciones se rigen, en lo relativo a los servicios prestados a usuarios en
              Espana, por la normativa espanola aplicable (LSSI-CE y RGPD/LOPDGDD), sin perjuicio
              del domicilio social de la entidad titular en Wyoming, Estados Unidos.
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

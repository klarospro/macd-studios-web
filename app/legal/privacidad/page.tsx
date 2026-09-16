import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Politica de Privacidad" };

export default function PrivacidadPage() {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-24">
      <div className="max-w-3xl mx-auto">
        <Link href="/" className="text-yellow-500 hover:text-yellow-400 text-sm mb-10 inline-block">
          ← Volver al inicio
        </Link>
        <h1 className="text-4xl font-bold mb-10">Politica de Privacidad</h1>

        <div className="prose prose-invert prose-yellow max-w-none space-y-8 text-gray-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-white mb-2">1. Responsable del tratamiento</h2>
            <p>
              <strong>MACD Studios LLC</strong> (Wyoming, Estados Unidos, EIN 30-1502570), contacto{" "}
              <a href="mailto:hola@macdestudios.com" className="text-yellow-500 hover:text-yellow-400">
                hola@macdestudios.com
              </a>
              , es responsable del tratamiento de los datos personales que nos facilites a traves
              de este sitio.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-2">2. Que datos recogemos</h2>
            <p>
              Segun el formulario que utilices, podemos recoger: nombre, email, telefono, nombre
              de negocio y mensaje. No recogemos datos bancarios ni de tarjeta directamente (los
              pagos se procesan a traves de Stripe, que trata esos datos bajo su propia politica
              de privacidad).
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-2">3. Con que finalidad</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Responder a tus consultas y solicitudes de presupuesto.</li>
              <li>Gestionar la relacion contractual si contratas nuestros servicios.</li>
              <li>Enviar comunicaciones relacionadas con el servicio contratado.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-2">4. Base legal</h2>
            <p>
              El tratamiento se basa en tu consentimiento al enviar un formulario y, en su caso,
              en la ejecucion de un contrato entre tu negocio y MACD Studios LLC.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-2">5. Con quien compartimos tus datos</h2>
            <p>
              Utilizamos proveedores tecnicos (hosting en Vercel, base de datos en Supabase,
              email transaccional en Resend, pagos en Stripe) que actuan como encargados del
              tratamiento bajo sus propias garantias de seguridad. No vendemos ni cedemos tus
              datos a terceros con fines comerciales.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-2">6. Tus derechos</h2>
            <p>
              Puedes ejercer tus derechos de acceso, rectificacion, supresion, oposicion,
              limitacion y portabilidad escribiendo a{" "}
              <a href="mailto:hola@macdestudios.com" className="text-yellow-500 hover:text-yellow-400">
                hola@macdestudios.com
              </a>
              .
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-white mb-2">7. Conservacion</h2>
            <p>
              Conservamos tus datos mientras exista una relacion contractual o comercial activa, y
              posteriormente durante los plazos legalmente exigibles.
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

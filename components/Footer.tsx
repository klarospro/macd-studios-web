import { Send, Share2, Mail } from "lucide-react";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="border-t border-yellow-600/20 py-16">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid md:grid-cols-3 gap-12 mb-12">
          <div>
            <Image src="/images/logo.png" alt="MACD Studios" width={160} height={50} className="h-12 w-auto object-contain mb-4" />
            <p className="text-gray-400 leading-relaxed">
              Automatizacion con inteligencia artificial para negocios que quieren crecer. Webs, bots y sistemas que venden.
            </p>
          </div>

          <div>
            <h4 className="font-bold mb-4 text-yellow-500">Navegacion</h4>
            <ul className="space-y-2 text-gray-400">
              <li><a href="#servicios" className="hover:text-yellow-500 transition-colors">Servicios</a></li>
              <li><a href="#trabajos" className="hover:text-yellow-500 transition-colors">Trabajos</a></li>
              <li><a href="#planes" className="hover:text-yellow-500 transition-colors">Planes</a></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-4 text-yellow-500">Contacto</h4>
            <ul className="space-y-3 text-gray-400">
              <li>
                <a href="https://t.me/macdstudios" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-yellow-500 transition-colors">
                  <Send className="w-4 h-4" />
                  Telegram: @macdstudios
                </a>
              </li>
              <li>
                <a href="https://www.instagram.com/macd_studios14" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 hover:text-yellow-500 transition-colors">
                  <Share2 className="w-4 h-4" />
                  @macd_studios14
                </a>
              </li>
              <li>
                <a href="mailto:hola@macdestudios.com" className="flex items-center gap-2 hover:text-yellow-500 transition-colors">
                  <Mail className="w-4 h-4" />
                  hola@macdestudios.com
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 text-center text-gray-500 text-sm">
          (c) 2026 MACD STUDIOS - Automatizacion con IA para tu negocio
        </div>
      </div>
    </footer>
  );
}

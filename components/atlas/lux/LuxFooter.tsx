export default function LuxFooter() {
  return (
    <footer className="border-t border-atlas-line/60 bg-atlas-bg2">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:px-10">
        <div className="flex flex-col gap-10 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[16px] font-medium tracking-[0.4em] text-atlas-ink">ATLAS</div>
            <p className="mt-3 max-w-xs text-[13px] font-light leading-relaxed text-atlas-muted">
              Firma de inversión privada. Gestión automatizada de capital con la preservación como
              primera doctrina.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-8 gap-y-3 text-[13px] text-atlas-muted">
            <a href="#manifiesto" className="transition-colors duration-300 hover:text-atlas-ink">Firma</a>
            <a href="#fortalezas" className="transition-colors duration-300 hover:text-atlas-ink">Principios</a>
            <a href="#enfoque" className="transition-colors duration-300 hover:text-atlas-ink">Enfoque</a>
            <a href="#cta" className="transition-colors duration-300 hover:text-atlas-ink">Contacto</a>
          </nav>
        </div>
        <p className="mt-14 border-t border-atlas-line/60 pt-7 text-[11.5px] font-light leading-relaxed text-atlas-muted/80">
          Aviso: las cifras y afirmaciones de esta página son ilustrativas y de presentación de marca; no
          constituyen una oferta, recomendación ni asesoramiento financiero, ni garantizan rentabilidad
          alguna. Toda operativa se valida primero en entornos de prueba. Los resultados pasados no
          garantizan resultados futuros. © {new Date().getFullYear()} ATLAS · MACD Studios.
        </p>
      </div>
    </footer>
  );
}

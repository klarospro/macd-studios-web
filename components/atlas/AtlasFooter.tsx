export default function AtlasFooter() {
  return (
    <footer className="border-t border-atlas-line/60 bg-atlas-bg2">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-atlas-teal to-atlas-blue text-sm font-black text-atlas-bg">A</span>
            <div>
              <div className="text-[15px] font-semibold text-atlas-ink">Atlas<span className="text-atlas-teal">AI</span></div>
              <div className="text-[12px] text-atlas-muted">Gestión automatizada de capital · MACD Studios</div>
            </div>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[13.5px] text-atlas-muted">
            <a href="#problema" className="transition-colors hover:text-atlas-ink">El problema</a>
            <a href="#solucion" className="transition-colors hover:text-atlas-ink">Solución</a>
            <a href="#sistema" className="transition-colors hover:text-atlas-ink">Sistema</a>
            <a href="#rutas" className="transition-colors hover:text-atlas-ink">Socios</a>
          </nav>
        </div>
        <p className="mt-10 border-t border-atlas-line/60 pt-6 text-[12px] leading-relaxed text-atlas-muted">
          Aviso: las cifras mostradas son ilustrativas y de diseño; no constituyen una oferta ni asesoramiento
          financiero, ni garantizan rentabilidad. Toda operativa se valida primero en cuentas demo. Los
          resultados pasados no garantizan resultados futuros. © {new Date().getFullYear()} MACD Studios.
        </p>
      </div>
    </footer>
  );
}

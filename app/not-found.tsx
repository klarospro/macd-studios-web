import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center text-center px-6 bg-black text-white">
      <div className="text-yellow-500 text-sm tracking-[0.3em] uppercase mb-4">Error 404</div>
      <h1 className="text-4xl lg:text-6xl font-bold mb-6">
        Esta pagina <span className="text-gold-gradient italic">no existe.</span>
      </h1>
      <p className="text-gray-400 max-w-md mb-10">
        Puede que el enlace este roto o que la pagina se haya movido. Volve al inicio y segui explorando.
      </p>
      <Link
        href="/"
        className="inline-flex items-center gap-2 bg-yellow-500 hover:bg-yellow-400 text-black font-medium px-8 py-3 rounded-2xl transition-colors duration-200"
      >
        Volver al inicio
      </Link>
    </main>
  );
}

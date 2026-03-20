import Link from "next/link";

export default function RaceNotFound() {
  return (
    <div className="max-w-2xl mx-auto pb-8">
      <div className="glass-nav border-b-2 border-[#ffff00] px-4 py-4 sticky top-0 z-10">
        <p className="tech-label text-[#cac8aa]">ERRORE</p>
        <h1 className="kinetic-italic text-xl text-[#f8f8f5] leading-none">
          Gara non trovata
        </h1>
      </div>
      <div className="px-4 pt-8 text-center space-y-4">
        <p className="text-[#cac8aa] text-sm">
          I dati per questa gara non sono ancora disponibili su ProCyclingStats,
          oppure la pagina è stata spostata.
        </p>
        <Link
          href="/races"
          className="inline-block bg-[#ffff00] text-black tech-label px-6 py-3 hover:bg-[#cdcd00] transition-colors"
        >
          ← TORNA AL CALENDARIO
        </Link>
      </div>
    </div>
  );
}

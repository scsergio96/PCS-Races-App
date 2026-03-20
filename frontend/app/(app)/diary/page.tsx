import { createClient } from "@/lib/supabase/server";
import { DiaryCard } from "@/components/diary/diary-card";
import Link from "next/link";
import type { DiaryEntry } from "@/types/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function fetchDiary(jwt: string, year?: number): Promise<DiaryEntry[]> {
  const query = year ? `?year=${year}` : "";
  try {
    const res = await fetch(`${API_URL}/diary${query}`, {
      headers: { Authorization: `Bearer ${jwt}` },
      cache: "no-store",
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

const currentYear = new Date().getFullYear();
const YEARS = [currentYear, currentYear - 1, currentYear - 2, currentYear - 3];

export default async function DiaryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const activeYear = Number(params.year ?? currentYear);

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const entries = await fetchDiary(session.access_token, activeYear);

  return (
    <div className="max-w-2xl mx-auto pb-8">
      {/* Header */}
      <div className="glass-nav border-b-2 border-[#ffff00] px-4 py-4 flex items-center justify-between sticky top-0 z-10">
        <h1 className="kinetic-italic text-xl text-[#f8f8f5]">Diary</h1>
        <Link
          href="/diary/new"
          className="bg-[#ffff00] text-black tech-label px-3 py-1.5 hover:bg-[#cdcd00] transition-colors"
        >
          NEW ENTRY
        </Link>
      </div>

      {/* Year tabs */}
      <nav className="flex bg-[#1a1a0a] border-b border-[#484831]">
        {YEARS.map((y) => (
          <Link
            key={y}
            href={`/diary?year=${y}`}
            className={`flex-1 text-center py-3 tech-label transition-colors ${
              y === activeYear
                ? "border-b-2 border-[#ffff00] text-[#ffff00]"
                : "text-[#cac8aa] opacity-60 hover:opacity-100"
            }`}
          >
            {y}
          </Link>
        ))}
      </nav>

      {/* Entries */}
      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-6 px-4">
          <div className="w-20 h-20 bg-[#202013] flex items-center justify-center border-2 border-dashed border-[#484831]">
            <span className="text-3xl">📓</span>
          </div>
          <div>
            <h2 className="kinetic-italic text-2xl text-[#f8f8f5]">
              Inizia il tuo diario
            </h2>
            <p className="text-[#cac8aa] mt-2 text-sm">
              Nessuna recensione per il {activeYear}.
            </p>
          </div>
          <Link
            href="/diary/new"
            className="bg-[#ffff00] text-black font-black px-8 py-3 tech-label hover:bg-[#cdcd00] transition-colors"
          >
            SCRIVI PRIMA RECENSIONE
          </Link>
        </div>
      ) : (
        <div className="divide-y divide-[#484831]">
          {entries.map((entry) => (
            <DiaryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

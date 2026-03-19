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
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-zinc-50">Il mio Diario</h1>
        <Link
          href="/diary/new"
          className="bg-[#E91E8C] hover:bg-[#c4186f] text-white text-sm font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          + Scrivi
        </Link>
      </div>

      {/* Year navigation — styled as tabs, server-rendered via URL param */}
      <div className="flex border-b border-zinc-800 mb-4">
        {YEARS.map((y) => (
          <Link
            key={y}
            href={`/diary?year=${y}`}
            className={`px-4 pb-2 border-b-2 text-sm transition-colors ${
              y === activeYear
                ? "border-[#E91E8C] text-zinc-50"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {y}
          </Link>
        ))}
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <p>Nessuna recensione per il {activeYear}.</p>
          <Link
            href="/diary/new"
            className="inline-block mt-4 bg-[#E91E8C] hover:bg-[#c4186f] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Scrivi la tua prima recensione
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <DiaryCard key={entry.id} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

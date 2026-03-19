import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { StarRating } from "@/components/diary/star-rating";
import { Badge } from "@/components/ui/badge";
import type { DiaryEntry } from "@/types/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type ShareEntry = DiaryEntry & { authorDisplayName?: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const res = await fetch(`${API_URL}/share/${token}`, {
    next: { revalidate: 300 },
  });
  if (!res.ok) return { title: "Recensione — CycleTracker" };

  const entry: ShareEntry = await res.json();
  const bodyExcerpt = entry.body.replace(/<[^>]+>/g, "").slice(0, 160);

  return {
    title: `${entry.raceName} ${entry.raceYear} — CycleTracker`,
    description: bodyExcerpt,
    openGraph: {
      title: `${entry.raceName} ${entry.raceYear}`,
      description: bodyExcerpt,
      type: "article",
    },
  };
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const res = await fetch(`${API_URL}/share/${token}`, {
    next: { revalidate: 300 },
  });

  if (!res.ok) notFound();

  const entry: ShareEntry = await res.json();

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-50">
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Branding */}
        <div className="text-center mb-8">
          <span className="text-lg font-bold">
            Cycle<span className="text-[#E91E8C]">Tracker</span>
          </span>
        </div>

        {/* Race header */}
        <div>
          <Badge
            variant="outline"
            className="border-zinc-700 text-zinc-400 text-xs mb-3"
          >
            Recensione pubblica
          </Badge>
          <h1 className="text-2xl font-bold text-zinc-50">{entry.raceName}</h1>
          <p className="text-zinc-400 text-sm mt-1">
            {entry.raceYear}
            {entry.authorDisplayName && ` · di ${entry.authorDisplayName}`}
          </p>
        </div>

        {/* Rating */}
        {entry.rating !== null && (
          <StarRating value={entry.rating} readonly size="lg" />
        )}

        {/* Body */}
        <div
          className="text-zinc-200 text-base leading-relaxed prose prose-invert prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: entry.body }}
        />

        {/* Structured fields */}
        {(entry.keyMoment || entry.protagonist || entry.dominantEmotion) && (
          <div className="bg-zinc-900 rounded-xl p-4 space-y-2 text-sm">
            {entry.keyMoment && (
              <div>
                <span className="text-zinc-500 text-xs uppercase tracking-wider">
                  Momento chiave
                </span>
                <p className="text-zinc-300 mt-0.5">{entry.keyMoment}</p>
              </div>
            )}
            {entry.protagonist && (
              <div>
                <span className="text-zinc-500 text-xs uppercase tracking-wider">
                  Protagonista
                </span>
                <p className="text-zinc-300 mt-0.5">{entry.protagonist}</p>
              </div>
            )}
            {entry.dominantEmotion && (
              <div>
                <span className="text-zinc-500 text-xs uppercase tracking-wider">
                  Emozione
                </span>
                <p className="text-zinc-300 mt-0.5">{entry.dominantEmotion}</p>
              </div>
            )}
          </div>
        )}

        {/* CTA */}
        <div className="border-t border-zinc-800 pt-6 text-center">
          <p className="text-zinc-500 text-sm mb-3">
            Tieni un diario delle tue gare preferite
          </p>
          <a
            href="/signup"
            className="inline-block bg-[#E91E8C] hover:bg-[#c4186f] text-white text-sm font-medium px-6 py-2 rounded-lg transition-colors"
          >
            Inizia gratis →
          </a>
        </div>
      </div>
    </div>
  );
}

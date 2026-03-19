import Link from "next/link";
import { CommunityCard } from "@/components/community/community-card";
import type { DiaryEntry } from "@/types/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type SortOption = "recent" | "popular" | "hot";

async function fetchFeed(sort: SortOption): Promise<DiaryEntry[]> {
  const res = await fetch(`${API_URL}/community/feed?sort=${sort}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return [];
  return res.json();
}

const SORT_LABELS: Record<SortOption, string> = {
  recent: "Recenti",
  popular: "Popolari",
  hot: "🔥 Hot",
};

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const sort = (params.sort as SortOption) ?? "recent";
  const reviews = await fetchFeed(sort);

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-8">
      <h1 className="text-xl font-bold text-zinc-50 mb-4">Community</h1>

      {/* Sort tabs */}
      <div className="flex gap-2 mb-4 border-b border-zinc-800 pb-2">
        {(["recent", "popular", "hot"] as const).map((s) => (
          <Link
            key={s}
            href={`/community?sort=${s}`}
            className={`text-sm px-3 py-1 rounded-full transition-colors ${
              sort === s
                ? "bg-[#E91E8C]/20 text-[#E91E8C]"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            {SORT_LABELS[s]}
          </Link>
        ))}
      </div>

      {reviews.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <p>Nessuna recensione pubblica ancora.</p>
          <p className="text-xs mt-1">Sii il primo a condividere la tua!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <CommunityCard key={review.id} review={review} />
          ))}
        </div>
      )}
    </div>
  );
}

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "@/components/diary/star-rating";
import type { DiaryEntry } from "@/types/api";

interface DiaryCardProps {
  entry: DiaryEntry;
}

export function DiaryCard({ entry }: DiaryCardProps) {
  return (
    <Link href={`/diary/${entry.id}`}>
      <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-4 hover:border-zinc-600 transition-colors">
        <div className="flex items-start justify-between gap-2 mb-2">
          <p className="font-semibold text-sm text-zinc-50 line-clamp-1">
            {entry.raceName}
          </p>
          <div className="flex items-center gap-1 shrink-0">
            {!entry.isPublic && (
              <Badge
                variant="outline"
                className="text-[10px] border-zinc-700 text-zinc-500"
              >
                Privata
              </Badge>
            )}
          </div>
        </div>
        {entry.rating !== null && (
          <div className="mb-2">
            <StarRating value={entry.rating} readonly size="sm" />
          </div>
        )}
        <p className="text-zinc-400 text-sm line-clamp-2">
          {entry.body.replace(/<[^>]+>/g, "")}
        </p>
      </div>
    </Link>
  );
}

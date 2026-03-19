"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { StarRating } from "@/components/diary/star-rating";
import { toast } from "sonner";
import type { DiaryEntry } from "@/types/api";

interface CommunityCardProps {
  review: DiaryEntry;
}

export function CommunityCard({ review }: CommunityCardProps) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(review.likeCount);

  const handleLike = async () => {
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikeCount((c) => (nextLiked ? c + 1 : c - 1));

    try {
      const res = await apiFetch<{ liked: boolean; count: number }>(
        `/diary/${review.id}/like`,
        { method: "POST" }
      );
      setLiked(res.liked);
      setLikeCount(res.count);
    } catch {
      setLiked(!nextLiked);
      setLikeCount((c) => (nextLiked ? c - 1 : c + 1));
      toast.error("Errore nel like. Riprova.");
    }
  };

  return (
    <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-sm text-zinc-50 truncate">
            {review.raceName}
          </p>
          <p className="text-xs text-zinc-500">{review.raceYear}</p>
        </div>
        {review.rating !== null && (
          <StarRating value={review.rating} readonly size="sm" />
        )}
      </div>

      <p className="text-zinc-300 text-sm line-clamp-3">
        {review.body.replace(/<[^>]+>/g, "")}
      </p>

      <div className="flex items-center gap-4 text-xs text-zinc-500">
        <button
          onClick={handleLike}
          className={`flex items-center gap-1 transition-colors ${
            liked ? "text-[#E91E8C]" : "hover:text-zinc-300"
          }`}
        >
          <span>{liked ? "❤" : "🤍"}</span>
          <span>{likeCount}</span>
        </button>
        <span className="flex items-center gap-1">
          <span>💬</span>
          <span>{review.commentCount}</span>
        </span>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { StarRating } from "@/components/diary/star-rating";
import { Heart, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import type { DiaryEntry } from "@/types/api";

interface CommunityCardProps {
  review: DiaryEntry;
}

export function CommunityCard({ review }: CommunityCardProps) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(review.likeCount);
  const bodyText = review.body.replace(/<[^>]+>/g, "");

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
    <div className="bg-[#202013] border border-[#484831] p-4 space-y-3">
      {/* User row */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-[#2b2b1d] border border-[#ffff00] flex items-center justify-center text-sm font-black text-[#ffff00]">
          {review.authorName?.[0]?.toUpperCase() ?? "?"}
        </div>
        <div>
          <p className="kinetic-italic text-sm text-[#f8f8f5]">
            {review.authorName ?? "Utente"}
          </p>
          <p className="tech-label text-[8px] text-[#cac8aa]">
            {review.raceYear}
          </p>
        </div>
        {review.rating !== null && (
          <div className="ml-auto">
            <StarRating value={review.rating} readonly size="sm" />
          </div>
        )}
      </div>

      {/* Race name */}
      <h3 className="kinetic-italic text-lg text-[#ffff00] leading-tight">
        {review.raceName}
      </h3>

      {/* Excerpt */}
      {bodyText && (
        <p className="text-[#cac8aa] text-sm line-clamp-3 italic">
          &ldquo;{bodyText}&rdquo;
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 pt-1">
        <button
          type="button"
          onClick={handleLike}
          className={`flex items-center gap-1.5 text-xs transition-colors ${
            liked ? "text-[#ffff00]" : "text-[#cac8aa] hover:text-[#f8f8f5]"
          }`}
        >
          <Heart className={`w-3.5 h-3.5 ${liked ? "fill-[#ffff00]" : ""}`} />
          <span className="tech-label">{likeCount}</span>
        </button>
        <span className="flex items-center gap-1.5 text-xs text-[#cac8aa]">
          <MessageCircle className="w-3.5 h-3.5" />
          <span className="tech-label">{review.commentCount}</span>
        </span>
      </div>
    </div>
  );
}

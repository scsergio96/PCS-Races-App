import { notFound } from "next/navigation";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StarRating } from "@/components/diary/star-rating";
import { CommentThread } from "@/components/community/comment-thread";
import { Badge } from "@/components/ui/badge";
import { ShareButton } from "./share-button";
import type { DiaryEntry, Comment } from "@/types/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default async function DiaryEntryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) notFound();

  const jwt = session.access_token;
  const headers = { Authorization: `Bearer ${jwt}` };

  const [entryRes, commentsRes] = await Promise.all([
    fetch(`${API_URL}/diary/${id}`, { headers, cache: "no-store" }),
    fetch(`${API_URL}/diary/${id}/comments`, { headers, cache: "no-store" }),
  ]);

  if (!entryRes.ok) notFound();

  const entry: DiaryEntry = await entryRes.json();
  const comments: Comment[] = commentsRes.ok ? await commentsRes.json() : [];

  // Fetch memories for same race (different years)
  const memoriesRes = await fetch(`${API_URL}/memories/${entry.raceBaseSlug}`, {
    headers,
  });
  const memories: DiaryEntry[] = memoriesRes.ok ? await memoriesRes.json() : [];
  const otherMemories = memories.filter((m) => m.id !== entry.id);

  const isOwner = entry.userId === session.user.id;

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-zinc-50">{entry.raceName}</h1>
          <p className="text-zinc-400 text-sm mt-0.5">{entry.raceYear}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          {isOwner && (
            <Link
              href={`/diary/${id}/edit`}
              className="flex items-center justify-center w-8 h-8 rounded-md border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition-colors"
            >
              <Pencil className="w-4 h-4" />
            </Link>
          )}
          {entry.isPublic && entry.shareToken && (
            <ShareButton raceName={entry.raceName} shareToken={entry.shareToken} />
          )}
        </div>
      </div>

      {/* Rating */}
      {entry.rating !== null && (
        <StarRating value={entry.rating} readonly size="lg" />
      )}

      {/* Body */}
      <div
        className="text-zinc-200 text-sm leading-relaxed prose prose-invert prose-sm max-w-none"
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

      {/* Badges */}
      <div className="flex gap-2">
        <Badge
          variant="outline"
          className={
            entry.isPublic
              ? "border-emerald-700 text-emerald-400"
              : "border-zinc-700 text-zinc-500"
          }
        >
          {entry.isPublic ? "Pubblica" : "Privata"}
        </Badge>
      </div>

      {/* Memories section */}
      {otherMemories.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
            I tuoi ricordi di questa gara
          </h2>
          <div className="space-y-2">
            {otherMemories.map((m) => (
              <Link key={m.id} href={`/diary/${m.id}`}>
                <div className="bg-zinc-900 rounded-xl p-3 hover:border-zinc-600 border border-zinc-800 transition-colors">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-semibold">{m.raceYear}</span>
                    {m.rating && (
                      <span className="text-yellow-400 text-sm">
                        {"★".repeat(m.rating)}
                      </span>
                    )}
                  </div>
                  <p className="text-zinc-400 text-xs line-clamp-2">
                    {m.body.replace(/<[^>]+>/g, "")}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Comment thread (only if public) */}
      {entry.isPublic && (
        <CommentThread diaryEntryId={entry.id} initialComments={comments} />
      )}
    </div>
  );
}

import { notFound } from "next/navigation";
import Link from "next/link";
import { Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { StarRating } from "@/components/diary/star-rating";
import { CommentThread } from "@/components/community/comment-thread";
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
    <div className="max-w-2xl mx-auto pb-8">
      {/* Sticky header */}
      <div className="glass-nav border-b-2 border-[#ffff00] px-4 py-4 sticky top-0 z-10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="kinetic-italic text-xl text-[#f8f8f5] leading-none">{entry.raceName}</h1>
            <p className="tech-label text-[#cac8aa] mt-1">{entry.raceYear}</p>
          </div>
          <div className="flex gap-2 shrink-0">
            {isOwner && (
              <Link
                href={`/diary/${id}/edit`}
                className="flex items-center justify-center w-8 h-8 border border-[#484831] text-[#cac8aa] hover:text-[#ffff00] hover:border-[#ffff00] transition-colors"
              >
                <Pencil className="w-4 h-4" />
              </Link>
            )}
            {entry.isPublic && entry.shareToken && (
              <ShareButton raceName={entry.raceName} shareToken={entry.shareToken} />
            )}
          </div>
        </div>
      </div>

      <div className="px-4 mt-4 space-y-6">
        {/* Rating */}
        {entry.rating !== null && (
          <StarRating value={entry.rating} readonly size="lg" />
        )}

        {/* Body */}
        <div
          className="text-[#f8f8f5] text-sm leading-relaxed prose prose-invert prose-sm max-w-none"
          dangerouslySetInnerHTML={{ __html: entry.body }}
        />

        {/* Structured fields */}
        {(entry.keyMoment || entry.protagonist || entry.dominantEmotion) && (
          <div className="bg-[#202013] border border-[#484831] p-4 space-y-3 text-sm">
            {entry.keyMoment && (
              <div>
                <span className="tech-label text-[#cac8aa] block mb-0.5">
                  Momento chiave
                </span>
                <p className="text-[#f8f8f5] mt-0.5">{entry.keyMoment}</p>
              </div>
            )}
            {entry.protagonist && (
              <div>
                <span className="tech-label text-[#cac8aa] block mb-0.5">
                  Protagonista
                </span>
                <p className="text-[#f8f8f5] mt-0.5">{entry.protagonist}</p>
              </div>
            )}
            {entry.dominantEmotion && (
              <div>
                <span className="tech-label text-[#cac8aa] block mb-0.5">
                  Emozione
                </span>
                <p className="text-[#f8f8f5] mt-0.5">{entry.dominantEmotion}</p>
              </div>
            )}
          </div>
        )}

        {/* Visibility */}
        <div className="flex gap-2">
          <span
            className={`tech-label px-2 py-1 border ${
              entry.isPublic
                ? "border-[#ffff00]/40 text-[#ffff00] bg-[#ffff00]/10"
                : "border-[#484831] text-[#cac8aa]"
            }`}
          >
            {entry.isPublic ? "PUBBLICA" : "PRIVATA"}
          </span>
        </div>

        {/* Memories section */}
        {otherMemories.length > 0 && (
          <div className="space-y-3">
            <h2 className="tech-label text-[#cac8aa]">
              I tuoi ricordi di questa gara
            </h2>
            <div className="space-y-2">
              {otherMemories.map((m) => (
                <Link key={m.id} href={`/diary/${m.id}`}>
                  <div className="bg-[#202013] border border-[#484831] p-3 hover:border-[#ffff00] transition-colors">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-semibold">{m.raceYear}</span>
                      {m.rating && (
                        <span className="text-[#ffff00] text-sm">
                          {"★".repeat(m.rating)}
                        </span>
                      )}
                    </div>
                    <p className="text-[#cac8aa] text-xs line-clamp-2">
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
    </div>
  );
}

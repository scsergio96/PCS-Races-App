"use client";

import { useState } from "react";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Comment } from "@/types/api";

type CommentWithChildren = Comment & { children: CommentWithChildren[] };

function buildTree(comments: Comment[]): CommentWithChildren[] {
  const map = new Map<string, CommentWithChildren>();
  const roots: CommentWithChildren[] = [];

  comments.forEach((c) => map.set(c.id, { ...c, children: [] }));
  comments.forEach((c) => {
    if (c.parentId) {
      map.get(c.parentId)?.children.push(map.get(c.id)!);
    } else {
      roots.push(map.get(c.id)!);
    }
  });

  return roots;
}

function CommentNode({
  comment,
  diaryEntryId,
  depth = 0,
  onRefresh,
}: {
  comment: CommentWithChildren;
  diaryEntryId: string;
  depth?: number;
  onRefresh: () => void;
}) {
  const [replying, setReplying] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleReply = async () => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      await apiFetch(`/diary/${diaryEntryId}/comments/${comment.id}/reply`, {
        method: "POST",
        body: JSON.stringify({ body: replyText }),
      });
      setReplyText("");
      setReplying(false);
      onRefresh();
    } catch {
      toast.error("Errore nell\u2019invio del commento.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className={cn(
        "space-y-2",
        depth > 0 && "ml-4 border-l border-[#484831] pl-3"
      )}
    >
      <div className="bg-[#202013] border border-[#484831] p-3">
        {comment.isRemoved ? (
          <p className="text-[#cac8aa] text-xs italic">Commento rimosso</p>
        ) : (
          <>
            <p className="text-sm text-[#f8f8f5]">{comment.body}</p>
            <div className="flex gap-3 mt-2 text-xs text-[#cac8aa]">
              <span>&#10084; {comment.likeCount}</span>
              {depth < 3 && (
                <button
                  onClick={() => setReplying(!replying)}
                  className="hover:text-[#ffff00] transition-colors"
                >
                  Rispondi
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {replying && (
        <div className="ml-4 space-y-2">
          <Textarea
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Scrivi una risposta..."
            className="bg-[#202013] border-[#484831] text-sm min-h-[80px]"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleReply}
              disabled={submitting}
              className="bg-[#ffff00] hover:bg-[#cdcd00] text-black text-xs"
            >
              Invia
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setReplying(false)}
              className="text-[#cac8aa] text-xs"
            >
              Annulla
            </Button>
          </div>
        </div>
      )}

      {comment.children.map((child) => (
        <CommentNode
          key={child.id}
          comment={child}
          diaryEntryId={diaryEntryId}
          depth={depth + 1}
          onRefresh={onRefresh}
        />
      ))}
    </div>
  );
}

interface CommentThreadProps {
  diaryEntryId: string;
  initialComments: Comment[];
}

export function CommentThread({
  diaryEntryId,
  initialComments,
}: CommentThreadProps) {
  const [comments, setComments] = useState(initialComments);
  const [newComment, setNewComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const refresh = async () => {
    const updated = await apiFetch<Comment[]>(
      `/diary/${diaryEntryId}/comments`
    ).catch(() => []);
    setComments(updated);
  };

  const handleTopLevelComment = async () => {
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      await apiFetch(`/diary/${diaryEntryId}/comments`, {
        method: "POST",
        body: JSON.stringify({ body: newComment }),
      });
      setNewComment("");
      await refresh();
    } catch {
      toast.error("Errore nell\u2019invio del commento.");
    } finally {
      setSubmitting(false);
    }
  };

  const tree = buildTree(comments);

  return (
    <div className="space-y-4">
      <h2 className="tech-label text-[#cac8aa]">
        Commenti ({comments.length})
      </h2>

      <div className="space-y-2">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Scrivi un commento..."
          className="bg-[#202013] border-[#484831] text-sm min-h-[80px]"
        />
        <Button
          size="sm"
          onClick={handleTopLevelComment}
          disabled={submitting}
          className="bg-[#ffff00] hover:bg-[#cdcd00] text-black"
        >
          {submitting ? "..." : "Commenta"}
        </Button>
      </div>

      {tree.map((comment) => (
        <CommentNode
          key={comment.id}
          comment={comment}
          diaryEntryId={diaryEntryId}
          onRefresh={refresh}
        />
      ))}
    </div>
  );
}

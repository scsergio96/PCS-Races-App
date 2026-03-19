"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Mention from "@tiptap/extension-mention";
import { apiFetch } from "@/lib/api";
import { StarRating } from "@/components/diary/star-rating";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import type { DiaryEntry, DiaryEntryCreate } from "@/types/api";

const DRAFT_KEY = "cycletracker_draft";

interface ReviewEditorProps {
  raceUrl?: string;
  raceName?: string;
  existing?: DiaryEntry;
}

export function ReviewEditor({ raceUrl, raceName, existing }: ReviewEditorProps) {
  const router = useRouter();
  const [rating, setRating] = useState<number | null>(existing?.rating ?? null);
  const [keyMoment, setKeyMoment] = useState(existing?.keyMoment ?? "");
  const [protagonist, setProtagonist] = useState(existing?.protagonist ?? "");
  const [dominantEmotion, setDominantEmotion] = useState(existing?.dominantEmotion ?? "");
  const [isPublic, setIsPublic] = useState(existing?.isPublic ?? false);
  const [saving, setSaving] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder:
          "Racconta la tua esperienza con questa gara... (usa @ per menzionare un corridore)",
      }),
      Mention.configure({
        HTMLAttributes: { class: "text-[#E91E8C] font-medium" },
        suggestion: {
          items: async ({ query }: { query: string }) => {
            return ["Tadej Pogacar", "Jonas Vingegaard", "Remco Evenepoel"]
              .filter((name) => name.toLowerCase().includes(query.toLowerCase()))
              .slice(0, 5);
          },
          render: () => {
            let element: HTMLElement | null = null;
            return {
              onStart: (props: {
                clientRect?: (() => DOMRect | null) | null;
                command: (attrs: Record<string, unknown>) => void;
                items: string[];
              }) => {
                element = document.createElement("ul");
                element.className =
                  "fixed z-50 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl text-sm overflow-hidden";
                props.items.forEach((item) => {
                  const li = document.createElement("li");
                  li.textContent = item;
                  li.className =
                    "px-3 py-2 cursor-pointer hover:bg-zinc-800 text-zinc-200";
                  li.addEventListener("click", () =>
                    props.command({ id: item, label: item })
                  );
                  element?.appendChild(li);
                });
                const rect = props.clientRect?.();
                if (rect && element) {
                  element.style.top = `${rect.bottom + window.scrollY + 4}px`;
                  element.style.left = `${rect.left + window.scrollX}px`;
                  document.body.appendChild(element);
                }
              },
              onUpdate: (props: {
                items: string[];
                command: (attrs: Record<string, unknown>) => void;
              }) => {
                if (!element) return;
                element.innerHTML = "";
                props.items.forEach((item) => {
                  const li = document.createElement("li");
                  li.textContent = item;
                  li.className =
                    "px-3 py-2 cursor-pointer hover:bg-zinc-800 text-zinc-200";
                  li.addEventListener("click", () =>
                    props.command({ id: item, label: item })
                  );
                  element?.appendChild(li);
                });
              },
              onExit: () => {
                element?.remove();
                element = null;
              },
            };
          },
        },
      }),
    ],
    content: existing?.body ?? "",
    editorProps: {
      attributes: {
        class: "min-h-[200px] outline-none prose prose-invert prose-sm max-w-none",
      },
    },
  });

  // Auto-save draft to localStorage every 30s (new entries only)
  useEffect(() => {
    if (!editor || existing) return;
    const interval = setInterval(() => {
      const draft = {
        raceUrl,
        raceName,
        body: editor.getHTML(),
        rating,
        keyMoment,
        protagonist,
        dominantEmotion,
        isPublic,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }, 30_000);
    return () => clearInterval(interval);
  }, [editor, rating, keyMoment, protagonist, dominantEmotion, isPublic, raceUrl, raceName, existing]);

  const handleSave = useCallback(async () => {
    if (!editor) return;
    if (!editor.getText().trim()) {
      toast.error("Scrivi qualcosa prima di salvare!");
      return;
    }

    setSaving(true);
    try {
      const yearMatch = raceUrl?.match(/\/(\d{4})/);
      const raceYear = yearMatch ? Number(yearMatch[1]) : new Date().getFullYear();
      const raceBaseSlug = raceUrl?.replace(/\/\d{4}.*/, "") ?? "";

      const payload: DiaryEntryCreate = {
        raceUrl: raceUrl ?? "",
        raceName: raceName ?? "",
        raceYear,
        raceBaseSlug,
        body: editor.getHTML(),
        rating,
        keyMoment: keyMoment || null,
        protagonist: protagonist || null,
        dominantEmotion: dominantEmotion || null,
        isPublic,
      };

      if (existing) {
        await apiFetch(`/diary/${existing.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        toast.success("Recensione aggiornata!");
      } else {
        await apiFetch<DiaryEntry>("/diary", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        localStorage.removeItem(DRAFT_KEY);
        toast.success("Recensione salvata!");
      }

      router.push("/diary");
      router.refresh();
    } catch {
      toast.error("Errore durante il salvataggio. Riprova.");
    } finally {
      setSaving(false);
    }
  }, [editor, rating, keyMoment, protagonist, dominantEmotion, isPublic, raceUrl, raceName, existing, router]);

  return (
    <div className="space-y-6">
      {/* Race context */}
      {raceName && (
        <div className="bg-zinc-900 rounded-xl p-3 text-sm text-zinc-300">
          &#128205; {raceName}
        </div>
      )}

      {/* Rating */}
      <div className="space-y-1">
        <Label className="text-zinc-400 text-xs uppercase tracking-wider">
          Valutazione
        </Label>
        <StarRating value={rating} onChange={setRating} size="lg" />
      </div>

      {/* Body — Tiptap */}
      <div className="space-y-1">
        <Label className="text-zinc-400 text-xs uppercase tracking-wider">
          Recensione
        </Label>
        <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-4 focus-within:border-[#E91E8C] transition-colors">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Optional structured fields */}
      <details className="space-y-3">
        <summary className="text-xs uppercase tracking-wider text-zinc-500 cursor-pointer select-none">
          Campi aggiuntivi (opzionale)
        </summary>
        <div className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label htmlFor="keyMoment" className="text-zinc-400 text-xs">
              Momento chiave
            </Label>
            <Input
              id="keyMoment"
              value={keyMoment}
              onChange={(e) => setKeyMoment(e.target.value)}
              placeholder="es. L'attacco di Pogacar sul Mont Ventoux"
              className="bg-zinc-900 border-zinc-700"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="protagonist" className="text-zinc-400 text-xs">
              Protagonista
            </Label>
            <Input
              id="protagonist"
              value={protagonist}
              onChange={(e) => setProtagonist(e.target.value)}
              placeholder="es. Tadej Pogacar"
              className="bg-zinc-900 border-zinc-700"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="emotion" className="text-zinc-400 text-xs">
              Emozione dominante
            </Label>
            <Input
              id="emotion"
              value={dominantEmotion}
              onChange={(e) => setDominantEmotion(e.target.value)}
              placeholder="es. entusiasmo"
              className="bg-zinc-900 border-zinc-700"
            />
          </div>
        </div>
      </details>

      {/* Public toggle */}
      <div className="flex items-center justify-between bg-zinc-900 rounded-xl p-4">
        <div>
          <p className="text-sm font-medium text-zinc-50">
            Condividi con la community
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">
            La tua recensione sar&agrave; visibile agli altri utenti
          </p>
        </div>
        <Switch
          checked={isPublic}
          onCheckedChange={(checked) => setIsPublic(checked)}
        />
      </div>

      {/* Save button */}
      <Button
        onClick={handleSave}
        disabled={saving}
        className="w-full bg-[#E91E8C] hover:bg-[#c4186f] text-white"
      >
        {saving
          ? "Salvataggio..."
          : existing
          ? "Aggiorna recensione"
          : "Salva recensione"}
      </Button>
    </div>
  );
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Mention from "@tiptap/extension-mention";
import { apiFetch } from "@/lib/api";
import { StarRating } from "@/components/diary/star-rating";
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
        HTMLAttributes: { class: "text-[#ffff00] font-medium" },
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
                command: (attrs: { id: string; label: string }) => void;
                items: string[];
              }) => {
                element = document.createElement("ul");
                element.className =
                  "fixed z-50 bg-[#202013] border border-[#484831] shadow-xl text-sm overflow-hidden";
                props.items.forEach((item) => {
                  const li = document.createElement("li");
                  li.textContent = item;
                  li.className =
                    "px-3 py-2 cursor-pointer hover:bg-[#2b2b1d] text-[#f8f8f5]";
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
                command: (attrs: { id: string; label: string }) => void;
              }) => {
                if (!element) return;
                element.innerHTML = "";
                props.items.forEach((item) => {
                  const li = document.createElement("li");
                  li.textContent = item;
                  li.className =
                    "px-3 py-2 cursor-pointer hover:bg-[#2b2b1d] text-[#f8f8f5]";
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
        <div className="bg-[#202013] border border-[#484831] p-3 text-sm text-[#cac8aa]">
          &#128205; {raceName}
        </div>
      )}

      {/* Rating */}
      <div className="space-y-1">
        <Label className="tech-label text-[9px] text-[#cac8aa]">
          Valutazione
        </Label>
        <StarRating value={rating} onChange={setRating} size="lg" />
      </div>

      {/* Body — Tiptap */}
      <div className="space-y-1">
        <Label className="tech-label text-[9px] text-[#cac8aa]">
          Recensione
        </Label>
        <div className="bg-[#202013] border border-[#484831] p-4 focus-within:border-[#ffff00] transition-colors">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Optional structured fields */}
      <details className="space-y-3">
        <summary className="tech-label text-[#cac8aa] cursor-pointer select-none">
          Campi aggiuntivi (opzionale)
        </summary>
        <div className="space-y-4 pt-2">
          <div className="space-y-1">
            <Label htmlFor="keyMoment" className="tech-label text-[9px] text-[#cac8aa]">
              Momento chiave
            </Label>
            <Input
              id="keyMoment"
              value={keyMoment}
              onChange={(e) => setKeyMoment(e.target.value)}
              placeholder="es. L'attacco di Pogacar sul Mont Ventoux"
              className="bg-[#202013] border-[#484831]"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="protagonist" className="tech-label text-[9px] text-[#cac8aa]">
              Protagonista
            </Label>
            <Input
              id="protagonist"
              value={protagonist}
              onChange={(e) => setProtagonist(e.target.value)}
              placeholder="es. Tadej Pogacar"
              className="bg-[#202013] border-[#484831]"
            />
          </div>
          {/* Dominant emotion chips */}
          <div>
            <Label className="tech-label text-[9px] text-[#cac8aa] block mb-2">
              EMOZIONE DOMINANTE
            </Label>
            <div className="flex flex-wrap gap-2">
              {["Adrenalina", "Tensione", "Sorpresa", "Fatica", "Gioia", "Tristezza"].map((emotion) => (
                <button
                  key={emotion}
                  type="button"
                  onClick={() =>
                    setDominantEmotion(dominantEmotion === emotion ? "" : emotion)
                  }
                  className={`px-3 py-1 tech-label text-[9px] border transition-colors ${
                    dominantEmotion === emotion
                      ? "border-[#ffff00] text-[#ffff00] bg-[#ffff00]/10"
                      : "border-[#484831] text-[#cac8aa] hover:border-[#ffff00]/50"
                  }`}
                >
                  {emotion.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </details>

      {/* Public toggle */}
      <div className="flex items-center justify-between bg-[#202013] border border-[#484831] p-4">
        <div>
          <p className="text-sm font-medium text-[#f8f8f5]">
            Condividi con la community
          </p>
          <p className="text-xs text-[#cac8aa] mt-0.5">
            La tua recensione sar&agrave; visibile agli altri utenti
          </p>
        </div>
        <Switch
          checked={isPublic}
          onCheckedChange={(checked) => setIsPublic(checked)}
        />
      </div>

      {/* Save button */}
      <button
        type="button"
        onClick={handleSave}
        disabled={saving || !rating}
        className="w-full bg-[#ffff00] text-black py-4 kinetic-italic text-xl disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#cdcd00] transition-colors flex items-center justify-center gap-2"
      >
        {saving ? "SALVATAGGIO..." : "SALVA RECENSIONE →"}
      </button>
    </div>
  );
}

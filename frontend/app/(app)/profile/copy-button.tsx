"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";

export function CopyButton({ text }: { text: string }) {
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(text);
        toast.success("Link copiato!");
      }}
      className="bg-[#ffff00] text-black tech-label px-3 py-1.5 shrink-0 hover:bg-[#cdcd00] transition-colors flex items-center gap-1.5"
      title="Copia link"
    >
      <Copy className="w-3 h-3" />
      COPIA
    </button>
  );
}

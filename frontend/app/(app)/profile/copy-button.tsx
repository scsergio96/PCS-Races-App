"use client";

import { Copy } from "lucide-react";
import { toast } from "sonner";

export function CopyButton({ text }: { text: string }) {
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text);
        toast.success("Link copiato!");
      }}
      className="shrink-0 text-zinc-500 hover:text-zinc-300 transition-colors"
      title="Copia link"
    >
      <Copy className="w-4 h-4" />
    </button>
  );
}

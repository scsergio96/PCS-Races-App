"use client";

import { Share2 } from "lucide-react";
import { toast } from "sonner";

interface ShareButtonProps {
  raceName: string;
  shareToken: string;
}

export function ShareButton({ raceName, shareToken }: ShareButtonProps) {
  const handleShare = () => {
    const shareUrl = `${window.location.origin}/share/${shareToken}`;
    if (navigator.share) {
      navigator.share({ title: raceName, url: shareUrl }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl);
      toast.success("Link copiato!");
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      className="flex items-center justify-center w-8 h-8 border border-[#484831] text-[#cac8aa] hover:text-[#ffff00] hover:border-[#ffff00] transition-colors"
    >
      <Share2 className="w-4 h-4" />
    </button>
  );
}

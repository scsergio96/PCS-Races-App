"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      toast.error(error.message);
    } else {
      router.push("/races");
      router.refresh();
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/races` },
    });
    if (error) toast.error(error.message);
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleEmailLogin} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-[#202013] border-[#484831]"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="bg-[#202013] border-[#484831]"
          />
        </div>
        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-[#ffff00] text-black font-black hover:bg-[#cdcd00] transition-colors rounded-none"
        >
          {loading ? "Accesso in corso..." : "Accedi"}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-[#484831]" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-[#1a1a0a] px-2 text-[#cac8aa]">oppure</span>
        </div>
      </div>

      <Button
        type="button"
        onClick={handleGoogleLogin}
        className="w-full border border-[#484831] bg-transparent hover:bg-[#2b2b1d] text-[#f8f8f5]"
      >
        Continua con Google
      </Button>

      <p className="text-center text-sm text-[#cac8aa]">
        Non hai un account?{" "}
        <Link href="/signup" className="text-[#ffff00] hover:underline">
          Registrati
        </Link>
      </p>
    </div>
  );
}

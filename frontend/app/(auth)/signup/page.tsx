"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: displayName } },
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Controlla la tua email per confermare l'account!");
      router.push("/login");
    }
    setLoading(false);
  };

  const handleGoogleLogin = async () => {
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/races` },
    });
    if (error) toast.error(error.message);
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSignup} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="displayName">Nome visualizzato</Label>
          <Input
            id="displayName"
            type="text"
            placeholder="Il tuo nome"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
            className="bg-zinc-900 border-zinc-700"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="tu@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="bg-zinc-900 border-zinc-700"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="Minimo 8 caratteri"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
            className="bg-zinc-900 border-zinc-700"
          />
        </div>
        <p className="text-xs text-zinc-500">
          Registrandoti accetti i nostri termini di servizio.
        </p>
        <Button
          type="submit"
          disabled={loading}
          className="w-full bg-[#E91E8C] hover:bg-[#c4186f] text-white"
        >
          {loading ? "Registrazione..." : "Crea account"}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-zinc-700" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-[#09090b] px-2 text-zinc-500">oppure</span>
        </div>
      </div>

      <Button
        type="button"
        onClick={handleGoogleLogin}
        className="w-full border border-zinc-700 bg-transparent hover:bg-zinc-800 text-zinc-200"
      >
        Continua con Google
      </Button>

      <p className="text-center text-sm text-zinc-400">
        Hai già un account?{" "}
        <Link href="/login" className="text-[#E91E8C] hover:underline">
          Accedi
        </Link>
      </p>
    </div>
  );
}

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, UserPlus } from "lucide-react";

interface Props {
  onSignup: (token: string, userId: string, username: string) => void;
  onGoLogin: () => void;
}

export default function SignupPage({ onSignup, onGoLogin }: Props) {
  const [username, setUsername] = useState("");
  const [passkey, setPasskey] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPasskey, setShowPasskey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const usernameRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (username.trim().length < 2) {
      setError("Username must be at least 2 characters");
      return;
    }
    if (passkey.length < 4) {
      setError("Passkey must be at least 4 characters");
      return;
    }
    if (passkey !== confirm) {
      setError("Passkeys do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), passkey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Sign-up failed");
      onSignup(data.token, data.userId || data.username, data.username);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center bg-[#000000]">
      <div className="w-full max-w-[360px] px-6 flex flex-col gap-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="w-16 h-16 rounded-3xl bg-[#00a884]/20 flex items-center justify-center">
            <UserPlus className="w-8 h-8 text-[#00a884]" />
          </div>
          <div>
            <h1 className="text-white text-2xl font-bold tracking-tight">Create Account</h1>
            <p className="text-[#8696a0] text-sm mt-1">Set up your username and passkey</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="username" className="text-[#e9edef] text-sm">Username</Label>
            <Input
              id="username"
              ref={usernameRef}
              autoFocus
              type="text"
              autoComplete="username"
              placeholder="Choose a username"
              value={username}
              onChange={(e) => { setUsername(e.target.value); setError(null); }}
              className="bg-[#1f2c34] border-[#2a3942] text-[#e9edef] placeholder:text-[#8696a0] focus-visible:ring-[#00a884] focus-visible:border-[#00a884] h-12 rounded-xl"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="passkey" className="text-[#e9edef] text-sm">Passkey</Label>
            <div className="relative">
              <Input
                id="passkey"
                type={showPasskey ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Create a passkey"
                value={passkey}
                onChange={(e) => { setPasskey(e.target.value); setError(null); }}
                className="bg-[#1f2c34] border-[#2a3942] text-[#e9edef] placeholder:text-[#8696a0] focus-visible:ring-[#00a884] focus-visible:border-[#00a884] h-12 rounded-xl pr-11"
              />
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setShowPasskey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8696a0] hover:text-[#e9edef] transition-colors"
              >
                {showPasskey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="text-[#8696a0] text-xs">Minimum 4 characters</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm" className="text-[#e9edef] text-sm">Confirm Passkey</Label>
            <Input
              id="confirm"
              type={showPasskey ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Repeat your passkey"
              value={confirm}
              onChange={(e) => { setConfirm(e.target.value); setError(null); }}
              className="bg-[#1f2c34] border-[#2a3942] text-[#e9edef] placeholder:text-[#8696a0] focus-visible:ring-[#00a884] focus-visible:border-[#00a884] h-12 rounded-xl"
            />
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={loading || !username.trim() || !passkey || !confirm}
            className="h-12 rounded-xl bg-[#00a884] hover:bg-[#00a884]/90 text-white font-semibold text-base mt-1"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Create Account"}
          </Button>
        </form>

        {/* Login link */}
        <div className="flex items-center justify-center gap-2 text-sm">
          <span className="text-[#8696a0]">Already have an account?</span>
          <button
            type="button"
            onClick={onGoLogin}
            className="text-[#00a884] font-semibold hover:underline"
          >
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
}

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, KeyRound } from "lucide-react";

interface Props {
  onLogin: (token: string, userId: string, username: string, isMaster: boolean) => void;
  onGoSignup: () => void;
}

export default function LoginPage({ onLogin, onGoSignup }: Props) {
  const [username, setUsername] = useState("");
  const [passkey, setPasskey] = useState("");
  const [showPasskey, setShowPasskey] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const passkeyRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    passkeyRef.current?.focus();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passkey.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim() || undefined, passkey }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      onLogin(data.token, data.isMaster ? "__master__" : data.userId || "__master__", data.username, !!data.isMaster);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
      setShake(true);
      setPasskey("");
      setTimeout(() => {
        setShake(false);
        passkeyRef.current?.focus();
      }, 600);
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
            <KeyRound className="w-8 h-8 text-[#00a884]" />
          </div>
          <div>
            <h1 className="text-white text-2xl font-bold tracking-tight">WhatsApp Monitor</h1>
            <p className="text-[#8696a0] text-sm mt-1">Sign in to continue</p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className={`flex flex-col gap-4 ${shake ? "animate-[shake_0.5s_ease-in-out]" : ""}`}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="username" className="text-[#e9edef] text-sm">
              Username <span className="text-[#8696a0] font-normal">(PRO)</span>
            </Label>
            <Input
              id="username"
              type="text"
              autoComplete="username"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="bg-[#1f2c34] border-[#2a3942] text-[#e9edef] placeholder:text-[#8696a0] focus-visible:ring-[#00a884] focus-visible:border-[#00a884] h-12 rounded-xl"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="passkey" className="text-[#e9edef] text-sm">Passkey</Label>
            <div className="relative">
              <Input
                id="passkey"
                ref={passkeyRef}
                type={showPasskey ? "text" : "password"}
                autoComplete="current-password"
                placeholder="Enter your passkey"
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
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <Button
            type="submit"
            disabled={loading || !passkey.trim()}
            className="h-12 rounded-xl bg-[#00a884] hover:bg-[#00a884]/90 text-white font-semibold text-base mt-1"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Sign In"}
          </Button>
        </form>

        {/* Signup link */}
        <div className="flex items-center justify-center gap-2 text-sm">
          <span className="text-[#8696a0]">Don't have an account?</span>
          <button
            type="button"
            onClick={onGoSignup}
            className="text-[#00a884] font-semibold hover:underline"
          >
            Create one
          </button>
        </div>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-8px); }
          30% { transform: translateX(8px); }
          45% { transform: translateX(-6px); }
          60% { transform: translateX(6px); }
          75% { transform: translateX(-4px); }
          90% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
}

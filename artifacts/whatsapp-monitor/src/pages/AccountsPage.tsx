import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useDeleteSession,
  useGetSessionQr,
} from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Plus, Trash2, Smartphone, Loader2, QrCode, Hash, CheckCircle2, Copy, RefreshCw, Lock, LockOpen, LogOut, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

// ── QR Scanner ───────────────────────────────────────────────────────────────
function QrScanner({ sessionId }: { sessionId: string }) {
  const { data: qrData, isLoading } = useGetSessionQr(sessionId, {
    query: { refetchInterval: 3000 },
  });

  if (isLoading || !qrData?.qrCode) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Generating QR code…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 py-3">
      <div className="bg-white p-4 rounded-2xl shadow-lg">
        <img src={qrData.qrCode} alt="WhatsApp QR Code" className="w-56 h-56 object-contain" />
      </div>
      <div className="w-full p-3 rounded-xl bg-primary/10 border border-primary/20">
        <p className="text-xs text-primary font-medium mb-1.5">Get ALL history from day 1:</p>
        <ol className="text-xs text-muted-foreground list-decimal list-inside space-y-1">
          <li>Open WhatsApp → <strong className="text-foreground">Settings → Linked Devices</strong></li>
          <li>Tap <strong className="text-foreground">Link a Device</strong></li>
          <li>Point camera at this QR code</li>
          <li>WhatsApp will sync your <strong className="text-foreground">full message history</strong></li>
        </ol>
      </div>
    </div>
  );
}

// ── Pairing Code Flow ────────────────────────────────────────────────────────
function PairingCodeLinker({ sessionId, onSuccess }: { sessionId: string; onSuccess: () => void }) {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [code, setCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useQuery({
    queryKey: ["session-status-poll", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/sessions/${sessionId}`);
      return res.json() as Promise<{ status: string }>;
    },
    refetchInterval: 3000,
    enabled: !!code,
    select: (data) => {
      if (data.status === "connected") onSuccess();
      return data;
    },
  });

  const handleGetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const cleaned = phoneNumber.replace(/\D/g, "");
      const res = await fetch(`/api/sessions/${sessionId}/pairing-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber: cleaned }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to get pairing code");
      setCode(data.code);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (code) {
      navigator.clipboard.writeText(code.replace("-", ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (code) {
    return (
      <div className="flex flex-col items-center gap-5 py-3">
        <div className="flex flex-col items-center gap-2">
          <p className="text-sm text-muted-foreground">Enter this code in WhatsApp</p>
          <div className="flex items-center gap-3">
            <span className="text-4xl font-mono font-bold tracking-widest text-foreground bg-secondary px-5 py-3 rounded-2xl border border-border">
              {code}
            </span>
            <Button variant="ghost" size="icon" onClick={handleCopy} className="text-muted-foreground hover:text-foreground">
              {copied ? <CheckCircle2 className="w-5 h-5 text-primary" /> : <Copy className="w-5 h-5" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Code expires in a few minutes</p>
        </div>

        <div className="w-full space-y-2 border border-border rounded-xl p-4 bg-secondary/30">
          <p className="text-sm font-medium text-foreground">How to enter the code:</p>
          <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-1.5">
            <li>Open WhatsApp on your phone</li>
            <li>Tap <strong className="text-foreground">Settings → Linked Devices</strong></li>
            <li>Tap <strong className="text-foreground">Link with phone number</strong></li>
            <li>Enter the code shown above</li>
          </ol>
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          Waiting for confirmation…
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleGetCode} className="flex flex-col gap-5 py-3">
      <div className="space-y-2">
        <Label htmlFor="phone">Your WhatsApp number</Label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">+</span>
          <Input
            id="phone"
            type="tel"
            placeholder="1 234 567 8900"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
            className="pl-7 bg-background border-border focus-visible:ring-primary"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Include country code — e.g. <span className="text-foreground font-mono">1 234 567 8900</span> for US
        </p>
      </div>

      {error && (
        <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
      )}

      <Button
        type="submit"
        className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
        disabled={loading || phoneNumber.replace(/\D/g, "").length < 7}
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Hash className="w-4 h-4 mr-2" />}
        Get Pairing Code
      </Button>
    </form>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
type LinkMethod = "qr" | "phone";

interface AccountsPageProps {
  onLogout: () => void;
  currentUser: { username: string; isMaster: boolean };
  userId: string;
  viewingUserId?: string;
}

export default function AccountsPage({ onLogout, currentUser, userId, viewingUserId }: AccountsPageProps) {
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [sessionName, setSessionName] = useState("");
  const [linkMethod, setLinkMethod] = useState<LinkMethod>("qr");
  const [creatingSession, setCreatingSession] = useState(false);

  const [linkingSessionId, setLinkingSessionId] = useState<string | null>(null);
  const [linkingMethod, setLinkingMethod] = useState<LinkMethod>("qr");
  const [linkingDialogOpen, setLinkingDialogOpen] = useState(false);

  const [reconnecting, setReconnecting] = useState<Set<string>>(new Set());
  const [togglingLock, setTogglingLock] = useState<Set<string>>(new Set());

  const sessionsQueryKey = ["sessions-by-user", userId];

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: sessionsQueryKey,
    queryFn: async () => {
      const url = `/api/sessions?userId=${encodeURIComponent(userId)}`;
      const res = await fetch(url);
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 5_000,
  });

  const deleteSession = useDeleteSession();

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionName.trim() || creatingSession) return;
    setCreatingSession(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: sessionName.trim(), userId }),
      });
      if (!res.ok) throw new Error("Failed to create session");
      const session = await res.json();
      setSessionName("");
      setDialogOpen(false);
      setLinkingSessionId(session.id);
      setLinkingMethod(linkMethod);
      setLinkingDialogOpen(true);
      queryClient.invalidateQueries({ queryKey: sessionsQueryKey });
    } catch {
      /* ignore */
    } finally {
      setCreatingSession(false);
    }
  };

  const handleLinked = () => {
    setLinkingDialogOpen(false);
    setLinkingSessionId(null);
    queryClient.invalidateQueries({ queryKey: sessionsQueryKey });
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm("Remove this account? All saved messages will be deleted.")) {
      deleteSession.mutate(
        { sessionId: id },
        { onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionsQueryKey }) }
      );
    }
  };

  const handleToggleLock = async (id: string, currentLocked: boolean, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setTogglingLock((prev) => new Set(prev).add(id));
    try {
      await fetch(`/api/sessions/${id}/lock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locked: !currentLocked }),
      });
      queryClient.invalidateQueries({ queryKey: sessionsQueryKey });
    } finally {
      setTogglingLock((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const [relinkPickerId, setRelinkPickerId] = useState<string | null>(null);

  const handleRelink = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setRelinkPickerId(id);
  };

  const handleRelinkWithMethod = async (method: LinkMethod) => {
    const id = relinkPickerId;
    if (!id) return;
    setRelinkPickerId(null);
    setReconnecting((prev) => new Set(prev).add(id));
    try {
      await fetch(`/api/sessions/${id}/reconnect`, { method: "POST" });
      queryClient.invalidateQueries({ queryKey: sessionsQueryKey });
      setLinkingSessionId(id);
      setLinkingMethod(method);
      setLinkingDialogOpen(true);
    } finally {
      setReconnecting((prev) => { const n = new Set(prev); n.delete(id); return n; });
    }
  };

  const isViewingOtherUser = !!viewingUserId && currentUser.isMaster;

  return (
    <div className="flex flex-col h-full bg-background relative">
      {/* Header */}
      <header className="px-4 py-3 border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isViewingOtherUser ? (
              <button
                onClick={() => setLocation("/")}
                className="text-primary hover:bg-primary/10 rounded-full w-8 h-8 flex items-center justify-center"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
            ) : (
              <Smartphone className="w-6 h-6 text-primary" />
            )}
            <h1 className="text-xl font-bold text-foreground tracking-tight">
              Linked Devices
            </h1>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setDialogOpen(true)}
              className="rounded-full text-primary hover:text-primary/80 hover:bg-primary/10"
            >
              <Plus className="w-5 h-5" />
            </Button>
            {!isViewingOtherUser && (
              <Button
                size="icon"
                variant="ghost"
                onClick={onLogout}
                className="rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isViewingOtherUser
            ? <span>Viewing <span className="text-primary font-medium">{viewingUserId}</span>'s devices</span>
            : <>Signed in as <span className="text-primary font-medium">{currentUser.username}</span></>
          }
        </p>
      </header>

      {/* Session list */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-none">
        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
              <Smartphone className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">No Linked Devices</h2>
              <p className="text-sm text-muted-foreground max-w-[250px]">
                Link a WhatsApp account to start monitoring chats and get full message history.
              </p>
            </div>
            <Button
              onClick={() => setDialogOpen(true)}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="w-4 h-4 mr-2" /> Link a Device
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider px-1">
              {isViewingOtherUser ? "Their Accounts" : "Your Accounts"}
            </h2>
            {sessions.map((session: any) => (
              <Link
                key={session.id}
                href={session.status === "connected" ? `/sessions/${session.id}` : "#"}
              >
                <div
                  className="flex items-center justify-between p-4 rounded-2xl bg-card border border-border hover:bg-secondary/50 transition-colors active:scale-[0.98]"
                  onClick={(e) => {
                    if (session.status === "pending") {
                      e.preventDefault();
                      setRelinkPickerId(session.id);
                    }
                  }}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center flex-shrink-0">
                      <Smartphone className="w-6 h-6 text-foreground" />
                    </div>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="font-semibold text-foreground truncate">{session.name}</span>
                      <span className="text-sm text-muted-foreground truncate">
                        {session.phone ? `+${session.phone}` : "Not yet connected"}
                      </span>
                      <div className="mt-0.5">
                        {session.status === "connected" && (
                          <Badge className="bg-primary/20 text-primary hover:bg-primary/20 text-xs px-2 py-0 border-0">
                            Connected
                          </Badge>
                        )}
                        {session.status === "pending" && (
                          <Badge className="text-yellow-500 border-yellow-500/50 bg-yellow-500/10 text-xs px-2 py-0" variant="outline">
                            Tap to link
                          </Badge>
                        )}
                        {session.status === "disconnected" && (
                          <Badge className="bg-destructive/20 text-destructive hover:bg-destructive/20 text-xs px-2 py-0 border-0">
                            Disconnected — tap Re-link
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                    {/* Re-link button for disconnected sessions */}
                    {session.status === "disconnected" && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => handleRelink(session.id, e)}
                        disabled={reconnecting.has(session.id)}
                        className="text-primary hover:bg-primary/10 w-9 h-9"
                        title="Re-link this account"
                      >
                        {reconnecting.has(session.id) ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4" />
                        )}
                      </Button>
                    )}
                    {/* Lock toggle button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleToggleLock(session.id, !!(session as any).locked, e)}
                      disabled={togglingLock.has(session.id)}
                      className={`w-9 h-9 ${(session as any).locked ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:text-primary hover:bg-primary/10"}`}
                      title={(session as any).locked ? "Locked — click to unlock" : "Unlocked — click to lock"}
                    >
                      {togglingLock.has(session.id) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (session as any).locked ? (
                        <Lock className="w-4 h-4" />
                      ) : (
                        <LockOpen className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={(e) => handleDelete(session.id, e)}
                      className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 w-9 h-9"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Info banner */}
        {sessions.length > 0 && (
          <div className="mx-1 p-3 rounded-xl bg-secondary/50 border border-border">
            <p className="text-xs text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Full history tip:</strong> When you link or re-link an account, WhatsApp automatically sends your <strong className="text-foreground">entire message history</strong> from the very beginning — all chats, all messages, all media. This is saved permanently to the database.
            </p>
          </div>
        )}
      </main>

      {/* ── Step 1: Name + Method choice ── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-sm w-[92%] rounded-2xl mx-auto dark border-border bg-card">
          <DialogHeader>
            <DialogTitle>Link a Device</DialogTitle>
            <DialogDescription>Name this connection then choose how to link.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreate} className="space-y-5 mt-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Connection name</Label>
              <Input
                id="name"
                placeholder="e.g. Personal Phone"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                className="bg-background border-border focus-visible:ring-primary"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Linking method</Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setLinkMethod("qr")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${
                    linkMethod === "qr"
                      ? "border-primary bg-primary/10"
                      : "border-border bg-secondary/30 hover:bg-secondary/60"
                  }`}
                >
                  <QrCode className={`w-7 h-7 ${linkMethod === "qr" ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`text-sm font-medium ${linkMethod === "qr" ? "text-primary" : "text-muted-foreground"}`}>
                    QR Code
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setLinkMethod("phone")}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-colors ${
                    linkMethod === "phone"
                      ? "border-primary bg-primary/10"
                      : "border-border bg-secondary/30 hover:bg-secondary/60"
                  }`}
                >
                  <Hash className={`w-7 h-7 ${linkMethod === "phone" ? "text-primary" : "text-muted-foreground"}`} />
                  <span className={`text-sm font-medium ${linkMethod === "phone" ? "text-primary" : "text-muted-foreground"}`}>
                    Phone Number
                  </span>
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={creatingSession || !sessionName.trim()}
            >
              {creatingSession ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : linkMethod === "qr" ? (
                <QrCode className="w-4 h-4 mr-2" />
              ) : (
                <Hash className="w-4 h-4 mr-2" />
              )}
              {linkMethod === "qr" ? "Continue to QR Code" : "Continue to Phone Link"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Re-link method picker ── */}
      <Dialog open={!!relinkPickerId} onOpenChange={(open) => { if (!open) setRelinkPickerId(null); }}>
        <DialogContent className="sm:max-w-sm w-[92%] rounded-2xl mx-auto dark border-border bg-card">
          <DialogHeader>
            <DialogTitle>Re-link Account</DialogTitle>
            <DialogDescription>Choose how you want to re-link this account.</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 mt-2">
            <button
              type="button"
              onClick={() => handleRelinkWithMethod("qr")}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border bg-secondary/30 hover:border-primary hover:bg-primary/10 transition-colors"
            >
              <QrCode className="w-7 h-7 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">QR Code</span>
            </button>
            <button
              type="button"
              onClick={() => handleRelinkWithMethod("phone")}
              className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-border bg-secondary/30 hover:border-primary hover:bg-primary/10 transition-colors"
            >
              <Hash className="w-7 h-7 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">Phone Number</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Step 2: QR or Pairing Code ── */}
      <Dialog
        open={linkingDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setLinkingDialogOpen(false);
            setLinkingSessionId(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-sm w-[92%] rounded-2xl mx-auto dark border-border bg-card">
          <DialogHeader>
            <DialogTitle>
              {linkingMethod === "qr" ? "Scan QR Code" : "Link with Phone Number"}
            </DialogTitle>
            <DialogDescription>
              {linkingMethod === "qr"
                ? "Scan with your WhatsApp camera to link and sync all history"
                : "Enter your number to receive a pairing code"}
            </DialogDescription>
          </DialogHeader>

          {linkingSessionId && linkingMethod === "qr" && (
            <QrScanner sessionId={linkingSessionId} />
          )}
          {linkingSessionId && linkingMethod === "phone" && (
            <PairingCodeLinker sessionId={linkingSessionId} onSuccess={handleLinked} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

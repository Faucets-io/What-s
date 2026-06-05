import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Loader2, CircleUser, Eye } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface StatusInfo {
  id: string;
  participantJid: string;
  participantName: string | null;
  type: "text" | "image" | "video" | "audio" | "other";
  body: string;
  timestamp: number;
  messageId: string;
}

interface GroupedStatus {
  participantJid: string;
  participantName: string | null;
  statuses: StatusInfo[];
  latestTimestamp: number;
}

function StatusViewer({
  group,
  sessionId,
  onClose,
}: {
  group: GroupedStatus;
  sessionId: string;
  onClose: () => void;
}) {
  const [current, setCurrent] = useState(0);
  const status = group.statuses[current];

  const mediaUrl = `/api/sessions/${encodeURIComponent(sessionId)}/chats/${encodeURIComponent("status@broadcast")}/messages/${encodeURIComponent(status.messageId)}/media`;

  const formatTime = (ts: number) =>
    new Date(ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const displayName = group.participantName || group.participantJid.split("@")[0];

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col" style={{ maxWidth: 390, margin: "0 auto" }}>
      {/* Progress bars */}
      <div className="flex gap-1 px-3 pt-3">
        {group.statuses.map((_, i) => (
          <div key={i} className="flex-1 h-0.5 rounded-full bg-white/30 overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-300"
              style={{ width: i < current ? "100%" : i === current ? "50%" : "0%" }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 px-3 py-3">
        <Avatar className="w-9 h-9 border-2 border-white/40">
          <AvatarFallback className="bg-[#202C33] text-white text-sm">
            {displayName[0]?.toUpperCase() || "?"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <p className="text-white font-semibold text-sm">{displayName}</p>
          <p className="text-white/60 text-xs">{formatTime(status.timestamp)}</p>
        </div>
        <button onClick={onClose} className="text-white/80 hover:text-white p-1">
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      {/* Content */}
      <div
        className="flex-1 relative flex items-center justify-center"
        onClick={(e) => {
          const x = e.clientX;
          const w = e.currentTarget.clientWidth;
          if (x < w / 3) {
            if (current > 0) setCurrent(current - 1);
            else onClose();
          } else {
            if (current < group.statuses.length - 1) setCurrent(current + 1);
            else onClose();
          }
        }}
      >
        {status.type === "image" ? (
          <img
            src={mediaUrl}
            alt="Status"
            className="max-w-full max-h-full object-contain"
          />
        ) : status.type === "video" ? (
          <video src={mediaUrl} controls className="max-w-full max-h-full" />
        ) : (
          <div className="flex items-center justify-center p-8">
            <p className="text-white text-xl text-center font-medium leading-relaxed">
              {status.body}
            </p>
          </div>
        )}

        {/* Tap zones hint */}
        <div className="absolute inset-0 flex pointer-events-none">
          <div className="flex-1" />
          <div className="flex-1" />
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-4 flex items-center gap-2">
        <Eye className="w-4 h-4 text-white/50" />
        <span className="text-white/50 text-sm">Tap left/right to navigate</span>
        <span className="ml-auto text-white/50 text-sm">
          {current + 1} / {group.statuses.length}
        </span>
      </div>
    </div>
  );
}

export default function StatusPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [viewing, setViewing] = useState<GroupedStatus | null>(null);

  const { data: statuses = [], isLoading } = useQuery<StatusInfo[]>({
    queryKey: ["statuses", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/statuses`);
      if (!res.ok) throw new Error("Failed to fetch statuses");
      return res.json();
    },
    enabled: !!sessionId,
    refetchInterval: 30000,
  });

  const { data: myStatuses = [] } = useQuery<StatusInfo[]>({
    queryKey: ["my-statuses", sessionId],
    queryFn: async () => {
      const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/statuses?fromMe=true`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!sessionId,
  });

  // Group by participant
  const grouped: GroupedStatus[] = [];
  const seen = new Set<string>();
  for (const s of statuses) {
    if (!seen.has(s.participantJid)) {
      seen.add(s.participantJid);
      const group = statuses.filter((x) => x.participantJid === s.participantJid);
      grouped.push({
        participantJid: s.participantJid,
        participantName: s.participantName,
        statuses: group.sort((a, b) => a.timestamp - b.timestamp),
        latestTimestamp: Math.max(...group.map((x) => x.timestamp)),
      });
    }
  }
  grouped.sort((a, b) => b.latestTimestamp - a.latestTimestamp);

  const formatTime = (ts: number) => {
    const date = new Date(ts * 1000);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    return date.toLocaleDateString([], { weekday: "short" });
  };

  if (viewing) {
    return <StatusViewer group={viewing} sessionId={sessionId} onClose={() => setViewing(null)} />;
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="px-4 py-3 border-b border-border bg-card sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Link
            href={`/sessions/${sessionId}`}
            className="text-primary hover:text-primary/80 p-1 -ml-1 rounded-full hover:bg-primary/10 transition-colors"
          >
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <h1 className="text-xl font-bold text-foreground">Status</h1>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto scrollbar-none">
        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-center px-6">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
              <CircleUser className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <h2 className="font-semibold text-foreground">No Recent Status</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Status updates from your contacts will appear here.
              </p>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 pt-4 pb-2">
              Recent updates
            </p>
            <div className="divide-y divide-border/50">
              {grouped.map((group) => {
                const displayName =
                  group.participantName || group.participantJid.split("@")[0];
                return (
                  <button
                    key={group.participantJid}
                    onClick={() => setViewing(group)}
                    className="w-full flex items-center gap-4 px-4 py-3 hover:bg-secondary/50 active:bg-secondary transition-colors text-left"
                  >
                    <div className="relative shrink-0">
                      <div className="w-14 h-14 rounded-full p-0.5 bg-gradient-to-tr from-[#00A884] to-[#25D366]">
                        <Avatar className="w-full h-full border-2 border-background">
                          <AvatarFallback className="bg-[#202C33] text-white">
                            {displayName[0]?.toUpperCase() || "?"}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground truncate">{displayName}</p>
                      <p className="text-sm text-muted-foreground">
                        {formatTime(group.latestTimestamp)} · {group.statuses.length}{" "}
                        {group.statuses.length === 1 ? "update" : "updates"}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

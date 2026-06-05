import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "wouter";
import { useSendMessage, useListChats, getListChatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, Loader2, Send, Play, Pause, FileText, ChevronUp,
  Search, X, Mic, Square, Video as VideoIcon,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

// ── Types ──────────────────────────────────────────────────────────────────────
interface MessageInfo {
  id: string;
  body: string;
  fromMe: boolean;
  timestamp: number;
  senderName: string | null;
  type: "text" | "image" | "video" | "audio" | "document" | "sticker" | "other";
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatTime(ts: number) {
  return new Date(ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function formatDateLabel(ts: number): string {
  const d = new Date(ts * 1000);
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString([], { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}
function sameDay(a: number, b: number) {
  return new Date(a * 1000).toDateString() === new Date(b * 1000).toDateString();
}
function mediaUrl(sessionId: string, chatId: string, messageId: string) {
  return `/api/sessions/${encodeURIComponent(sessionId)}/chats/${encodeURIComponent(chatId)}/messages/${encodeURIComponent(messageId)}/media`;
}

// ── Fetch messages ────────────────────────────────────────────────────────────
async function fetchMessages(
  sessionId: string,
  chatId: string,
  opts: { limit?: number; before?: string } = {}
): Promise<MessageInfo[]> {
  const params = new URLSearchParams();
  if (opts.limit) params.set("limit", String(opts.limit));
  if (opts.before) params.set("before", opts.before);
  const qs = params.toString() ? `?${params}` : "";
  const res = await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/chats/${encodeURIComponent(chatId)}/messages${qs}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.messages ?? data ?? [];
}

// ── Image Lightbox ─────────────────────────────────────────────────────────────
function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);
  return (
    <div
      className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/70 hover:text-white bg-white/10 rounded-full p-2"
      >
        <X className="w-5 h-5" />
      </button>
      <img
        src={src}
        alt="Full size"
        className="max-w-full max-h-full object-contain rounded-lg"
        onClick={(e) => e.stopPropagation()}
      />
    </div>
  );
}

// ── Media components ──────────────────────────────────────────────────────────
function MediaImage({
  sessionId, chatId, messageId, caption,
}: { sessionId: string; chatId: string; messageId: string; caption?: string }) {
  const [lightbox, setLightbox] = useState(false);
  const src = mediaUrl(sessionId, chatId, messageId);
  return (
    <>
      {lightbox && <ImageLightbox src={src} onClose={() => setLightbox(false)} />}
      <div className="flex flex-col gap-1">
        <img
          src={src}
          alt={caption || "Image"}
          className="rounded-lg max-w-[220px] max-h-[220px] object-cover cursor-pointer active:opacity-80 transition-opacity"
          loading="lazy"
          onClick={() => setLightbox(true)}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
        {caption && <span className="text-[14px] leading-snug break-words">{caption}</span>}
      </div>
    </>
  );
}

function AudioPlayer({ sessionId, chatId, messageId }: { sessionId: string; chatId: string; messageId: string }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const src = mediaUrl(sessionId, chatId, messageId);
  const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;
  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <audio
        ref={audioRef}
        src={src}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setProgress(0); }}
        onTimeUpdate={() => { const a = audioRef.current; if (a?.duration) setProgress(a.currentTime / a.duration); }}
        onLoadedMetadata={() => { if (audioRef.current) setDuration(audioRef.current.duration); }}
      />
      <button
        onClick={() => { const a = audioRef.current; if (!a) return; playing ? a.pause() : a.play().catch(() => {}); }}
        className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0 hover:bg-white/30 transition-colors"
      >
        {playing ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
      </button>
      <div className="flex-1 flex flex-col gap-1">
        <div
          className="h-1 bg-white/20 rounded-full overflow-hidden cursor-pointer"
          onClick={(e) => {
            const a = audioRef.current;
            if (!a?.duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            a.currentTime = ((e.clientX - rect.left) / rect.width) * a.duration;
          }}
        >
          <div className="h-full bg-white/80 rounded-full transition-all" style={{ width: `${progress * 100}%` }} />
        </div>
        <span className="text-[11px] text-current/60">
          {duration > 0 ? `${fmt(duration * progress)} / ${fmt(duration)}` : "Audio"}
        </span>
      </div>
    </div>
  );
}

function VideoPlayer({ sessionId, chatId, messageId, caption }: { sessionId: string; chatId: string; messageId: string; caption?: string }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const src = mediaUrl(sessionId, chatId, messageId);
  const fmt = (s: number) => `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="flex flex-col gap-1 max-w-[240px]">
      <div className="relative rounded-lg overflow-hidden bg-black/40">
        <video
          ref={videoRef}
          src={src}
          className="w-full max-h-[200px] object-contain"
          preload="metadata"
          onLoadedMetadata={() => { setLoaded(true); if (videoRef.current) setDuration(videoRef.current.duration); }}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => { setPlaying(false); setProgress(0); }}
          onTimeUpdate={() => { const v = videoRef.current; if (v?.duration) setProgress(v.currentTime / v.duration); }}
        />
        {loaded && (
          <button
            onClick={() => { const v = videoRef.current; if (!v) return; playing ? v.pause() : v.play().catch(() => {}); }}
            className="absolute inset-0 flex items-center justify-center bg-black/20 hover:bg-black/30 transition-colors"
          >
            {!playing && (
              <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
                <Play className="w-6 h-6 fill-white text-white ml-1" />
              </div>
            )}
          </button>
        )}
        {!loaded && (
          <div className="absolute inset-0 flex items-center justify-center">
            <VideoIcon className="w-8 h-8 text-white/50" />
          </div>
        )}
      </div>
      {loaded && (
        <div className="flex items-center gap-2 px-1">
          <div
            className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden cursor-pointer"
            onClick={(e) => {
              const v = videoRef.current;
              if (!v?.duration) return;
              const rect = e.currentTarget.getBoundingClientRect();
              v.currentTime = ((e.clientX - rect.left) / rect.width) * v.duration;
            }}
          >
            <div className="h-full bg-white/80 rounded-full" style={{ width: `${progress * 100}%` }} />
          </div>
          <span className="text-[10px] text-current/60 shrink-0">
            {fmt(duration * progress)}/{fmt(duration)}
          </span>
        </div>
      )}
      {caption && <span className="text-[14px] leading-snug break-words">{caption}</span>}
    </div>
  );
}

// ── Message bubble ─────────────────────────────────────────────────────────────
function MessageBubble({
  msg, sessionId, chatId, isGroup, showSender,
}: { msg: MessageInfo; sessionId: string; chatId: string; isGroup: boolean; showSender: boolean }) {
  const caption = msg.body.replace(/^\[(Image|Video)\]\s*/, "").trim();
  return (
    <div className={`flex ${msg.fromMe ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[80%] flex flex-col ${msg.fromMe ? "items-end" : "items-start"}`}>
        <div className={`relative rounded-xl px-3 py-2 shadow-sm ${
          msg.fromMe ? "bg-[#005C4B] text-[#E9EDEF] rounded-tr-sm" : "bg-[#202C33] text-[#E9EDEF] rounded-tl-sm"
        }`}>
          {showSender && isGroup && !msg.fromMe && msg.senderName && (
            <div className="text-[13px] font-semibold text-[#00A884] mb-1">{msg.senderName}</div>
          )}
          {msg.type === "image" && (
            <MediaImage sessionId={sessionId} chatId={chatId} messageId={msg.id} caption={caption || undefined} />
          )}
          {msg.type === "audio" && (
            <AudioPlayer sessionId={sessionId} chatId={chatId} messageId={msg.id} />
          )}
          {msg.type === "video" && (
            <VideoPlayer sessionId={sessionId} chatId={chatId} messageId={msg.id} caption={caption || undefined} />
          )}
          {msg.type === "document" && (
            <a
              href={mediaUrl(sessionId, chatId, msg.id)}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-sm underline-offset-2 hover:underline"
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span className="truncate max-w-[160px]">{caption || "Document"}</span>
            </a>
          )}
          {msg.type === "sticker" && (
            <img src={mediaUrl(sessionId, chatId, msg.id)} alt="Sticker" className="w-20 h-20 object-contain" />
          )}
          {msg.type !== "image" && msg.type !== "audio" && msg.type !== "video" && msg.type !== "document" && msg.type !== "sticker" && (
            <div className="text-[15px] leading-snug break-words whitespace-pre-wrap">{msg.body}</div>
          )}
          <div className={`text-[11px] mt-1 flex items-center justify-end gap-1 ${msg.fromMe ? "text-[#85BDB3]" : "text-[#8696A0]"}`}>
            {formatTime(msg.timestamp)}
            {msg.fromMe && (
              <svg viewBox="0 0 16 11" width="14" height="11" className="fill-[#53BDEB] shrink-0">
                <path d="M11.8 1L10.4 2.4L14 6L11.8 8.2L13.2 9.6L16.8 6L11.8 1ZM7.8 1L6.4 2.4L10 6L7.8 8.2L9.2 9.6L12.8 6L7.8 1ZM4.2 9.6L0.6 6L2.8 3.8L4.2 5.2L7.8 1.6L9.2 3L4.2 9.6Z" />
              </svg>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Date separator ─────────────────────────────────────────────────────────────
function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex justify-center my-3">
      <span className="bg-[#182229] text-[#8696A0] text-[12px] px-3 py-1 rounded-lg shadow-sm">{label}</span>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function ConversationPage() {
  const { sessionId, chatId: rawChatId } = useParams<{ sessionId: string; chatId: string }>();
  const chatId = rawChatId ? decodeURIComponent(rawChatId) : rawChatId;
  const [newMessage, setNewMessage] = useState("");
  const [allMessages, setAllMessages] = useState<MessageInfo[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // ── Voice note recording ──────────────────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [sendingVoice, setSendingVoice] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
        ? "audio/ogg;codecs=opus"
        : "audio/webm";
      const mr = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        if (blob.size < 500) return; // too short, discard
        setSendingVoice(true);
        try {
          const arrayBuffer = await blob.arrayBuffer();
          const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
          await fetch(`/api/sessions/${encodeURIComponent(sessionId)}/chats/${encodeURIComponent(chatId)}/voice-note`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ audio: base64, mimetype: mimeType }),
          });
          queryClient.invalidateQueries({ queryKey: ["messages-live", sessionId, chatId] });
        } finally {
          setSendingVoice(false);
        }
      };
      mr.start(200);
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch {
      alert("Microphone access denied. Please allow microphone access to send voice notes.");
    }
  };

  const stopRecording = () => {
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const cancelRecording = () => {
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    mediaRecorderRef.current?.stream?.getTracks().forEach((t) => t.stop());
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: chats = [] } = useListChats(sessionId, { query: { enabled: !!sessionId } as any });
  const chat = chats.find((c) => c.id === chatId);
  const chatName = chat?.name || (chatId ? chatId.split("@")[0] : "Chat");

  // ── Initial load + fallback polling ──────────────────────────────────────────
  const { data: freshMessages } = useQuery({
    queryKey: ["messages-live", sessionId, chatId],
    enabled: !!(sessionId && chatId),
    refetchInterval: 30_000,
    queryFn: () => fetchMessages(sessionId, chatId, { limit: 50 }),
  });

  useEffect(() => {
    if (!freshMessages) return;
    setAllMessages((prev) => {
      if (!initialLoaded) return freshMessages;
      const existingIds = new Set(prev.map((m) => m.id));
      const newOnes = freshMessages.filter(
        (m) => !existingIds.has(m.id) && m.timestamp > (prev[prev.length - 1]?.timestamp ?? 0)
      );
      return newOnes.length === 0 ? prev : [...prev, ...newOnes];
    });
    if (!initialLoaded) setInitialLoaded(true);
  }, [freshMessages]);

  // ── SSE real-time subscription ────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;
    const es = new EventSource(`/api/sessions/${encodeURIComponent(sessionId)}/events`);
    es.addEventListener("message", (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.chatId === chatId) {
          queryClient.invalidateQueries({ queryKey: ["messages-live", sessionId, chatId] });
        }
      } catch { /* ignore */ }
    });
    es.addEventListener("chat", () => {
      queryClient.invalidateQueries({ queryKey: getListChatsQueryKey(sessionId) });
    });
    return () => es.close();
  }, [sessionId, chatId, queryClient]);

  // Scroll to bottom on initial load
  useEffect(() => {
    if (initialLoaded && allMessages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [initialLoaded]);

  // Scroll to bottom when new message arrives (if already near bottom)
  const lastMsgId = allMessages[allMessages.length - 1]?.id;
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [lastMsgId]);

  // Focus search when opened
  useEffect(() => {
    if (searchOpen) setTimeout(() => searchInputRef.current?.focus(), 50);
  }, [searchOpen]);

  // ── Load older messages ───────────────────────────────────────────────────────
  const loadOlderMessages = useCallback(async () => {
    if (loadingOlder || !hasMore || allMessages.length === 0) return;
    const oldestId = allMessages[0]?.id;
    if (!oldestId) return;
    setLoadingOlder(true);
    const el = scrollRef.current;
    const prevScrollHeight = el?.scrollHeight ?? 0;
    try {
      const older = await fetchMessages(sessionId, chatId, { limit: 50, before: oldestId });
      if (older.length === 0) {
        setHasMore(false);
      } else {
        setAllMessages((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          return [...older.filter((m) => !existingIds.has(m.id)), ...prev];
        });
        requestAnimationFrame(() => {
          if (el) el.scrollTop = el.scrollHeight - prevScrollHeight;
        });
        if (older.length < 50) setHasMore(false);
      }
    } finally {
      setLoadingOlder(false);
    }
  }, [sessionId, chatId, allMessages, loadingOlder, hasMore]);

  // ── Send message ──────────────────────────────────────────────────────────────
  const sendMessageMutation = useSendMessage();

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !sessionId || !chatId) return;
    const text = newMessage.trim();
    setNewMessage("");
    sendMessageMutation.mutate(
      { sessionId, chatId, data: { message: text } },
      { onSuccess: () => queryClient.invalidateQueries({ queryKey: ["messages-live", sessionId, chatId] }) }
    );
  };

  // ── Filtered messages (search) ────────────────────────────────────────────────
  const displayMessages = searchQuery.trim()
    ? allMessages.filter((m) => m.body.toLowerCase().includes(searchQuery.toLowerCase()))
    : allMessages;

  // ── Build render list with date separators ────────────────────────────────────
  const renderItems: Array<{ type: "date"; label: string } | { type: "msg"; msg: MessageInfo; showSender: boolean }> = [];
  for (let i = 0; i < displayMessages.length; i++) {
    const msg = displayMessages[i];
    const prev = displayMessages[i - 1];
    if (!prev || !sameDay(prev.timestamp, msg.timestamp)) {
      renderItems.push({ type: "date", label: formatDateLabel(msg.timestamp) });
    }
    const showSender = !!chat?.isGroup && !msg.fromMe &&
      (!prev || prev.senderName !== msg.senderName || prev.fromMe || !sameDay(prev.timestamp, msg.timestamp));
    renderItems.push({ type: "msg", msg, showSender });
  }

  return (
    <div className="flex flex-col h-full bg-background relative overflow-hidden">
      {/* Header */}
      <header className="px-3 py-2 border-b border-border bg-card/95 backdrop-blur-md sticky top-0 z-10">
        {searchOpen ? (
          <div className="flex items-center gap-2 h-10">
            <button
              onClick={() => { setSearchOpen(false); setSearchQuery(""); }}
              className="text-primary p-1.5 rounded-full hover:bg-primary/10"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search messages…"
              className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground outline-none text-[15px]"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="text-muted-foreground p-1">
                <X className="w-4 h-4" />
              </button>
            )}
            {searchQuery && (
              <span className="text-xs text-muted-foreground shrink-0">
                {displayMessages.length} result{displayMessages.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Link href={`/sessions/${encodeURIComponent(sessionId)}`} className="text-primary hover:text-primary/80 p-1.5 -ml-1.5 rounded-full hover:bg-primary/10">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-3">
                <Avatar className="w-9 h-9 border border-border">
                  <AvatarImage src={chat?.profilePicture || undefined} />
                  <AvatarFallback className="bg-secondary text-muted-foreground text-sm">
                    {chatName?.[0]?.toUpperCase() || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="font-semibold text-foreground text-[15px] leading-tight truncate max-w-[160px]">{chatName}</span>
                  {chat?.phone && <span className="text-xs text-muted-foreground truncate max-w-[160px]">+{chat.phone}</span>}
                </div>
              </div>
            </div>
            <button
              onClick={() => setSearchOpen(true)}
              className="text-primary hover:bg-primary/10 rounded-full w-9 h-9 flex items-center justify-center"
            >
              <Search className="w-5 h-5" />
            </button>
          </div>
        )}
      </header>

      {/* Messages */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto p-3 bg-[#0B141A] scrollbar-none">
        {initialLoaded && hasMore && !searchQuery && (
          <div className="flex justify-center mb-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={loadOlderMessages}
              disabled={loadingOlder}
              className="text-[#8696A0] hover:text-[#E9EDEF] bg-[#182229] hover:bg-[#2A3942] rounded-xl text-xs px-4 py-2 gap-1.5"
            >
              {loadingOlder ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronUp className="w-3 h-3" />}
              {loadingOlder ? "Loading…" : "Load older messages"}
            </Button>
          </div>
        )}

        {!initialLoaded ? (
          <div className="flex justify-center items-center h-full">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : renderItems.length === 0 ? (
          <div className="flex justify-center items-center h-full">
            <span className="bg-[#182229] text-[#8696A0] text-xs px-4 py-2 rounded-lg">
              {searchQuery ? `No messages matching "${searchQuery}"` : "No messages yet"}
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 pb-2">
            {renderItems.map((item, idx) =>
              item.type === "date" ? (
                <DateSeparator key={`date-${idx}`} label={item.label} />
              ) : (
                <MessageBubble
                  key={item.msg.id || idx}
                  msg={item.msg}
                  sessionId={sessionId}
                  chatId={chatId}
                  isGroup={!!chat?.isGroup}
                  showSender={item.showSender}
                />
              )
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* Input — hidden while searching */}
      {!searchOpen && (
        <div className="px-2 py-2 border-t border-border bg-card flex items-end gap-2">
          {isRecording ? (
            /* Recording UI */
            <div className="flex-1 flex items-center gap-3 bg-[#1F2C34] rounded-2xl border border-red-500/40 px-4 h-[44px]">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
              <span className="text-red-400 text-sm font-medium flex-1">
                Recording… {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, "0")}
              </span>
              <button
                onClick={cancelRecording}
                className="text-[#8696A0] hover:text-[#E9EDEF] text-xs px-2"
              >
                Cancel
              </button>
            </div>
          ) : (
            <form onSubmit={handleSend} className="flex-1 flex items-end bg-[#1F2C34] rounded-2xl border border-border/30 overflow-hidden px-3">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e as unknown as React.FormEvent);
                  }
                }}
                placeholder="Message"
                className="flex-1 bg-transparent text-[#E9EDEF] placeholder:text-[#8696A0] outline-none py-2.5 resize-none min-h-[40px] max-h-[120px] text-[15px]"
                rows={1}
                style={{ height: newMessage ? `${Math.min(120, Math.max(40, newMessage.split("\n").length * 22 + 18))}px` : "40px" }}
              />
            </form>
          )}

          {/* Right action button: Send (text) / Stop recording / Mic */}
          {newMessage.trim() && !isRecording ? (
            <Button
              onClick={handleSend}
              size="icon"
              disabled={sendMessageMutation.isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shrink-0 w-10 h-10"
            >
              {sendMessageMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4 ml-0.5" />}
            </Button>
          ) : isRecording ? (
            <Button
              onClick={stopRecording}
              size="icon"
              disabled={sendingVoice}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full shrink-0 w-10 h-10"
            >
              {sendingVoice ? <Loader2 className="w-4 h-4 animate-spin" /> : <Square className="w-4 h-4 fill-current" />}
            </Button>
          ) : (
            <Button
              onClick={startRecording}
              size="icon"
              className="bg-[#1F2C34] hover:bg-[#2A3942] text-[#8696A0] hover:text-primary border border-border/30 rounded-full shrink-0 w-10 h-10"
            >
              <Mic className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useListChats, useGetSession, getListChatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Search, Loader2, MessageSquare, Users, CircleDot } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export default function ChatsPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: session } = useGetSession(sessionId, {
    query: { enabled: !!sessionId } as any,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: chats = [], isLoading } = useListChats(sessionId, {
    query: { enabled: !!sessionId, refetchInterval: 30_000 } as any,
  });

  // Real-time updates via SSE
  useEffect(() => {
    if (!sessionId) return;
    const es = new EventSource(`/api/sessions/${encodeURIComponent(sessionId)}/events`);
    es.addEventListener("chat", () => {
      queryClient.invalidateQueries({ queryKey: getListChatsQueryKey(sessionId) });
    });
    es.addEventListener("message", () => {
      queryClient.invalidateQueries({ queryKey: getListChatsQueryKey(sessionId) });
    });
    return () => es.close();
  }, [sessionId, queryClient]);

  const filtered = search.trim()
    ? chats.filter(
        (c) =>
          c.name?.toLowerCase().includes(search.toLowerCase()) ||
          c.phone?.includes(search)
      )
    : chats;

  const formatTime = (timeStr: string | null) => {
    if (!timeStr) return "";
    const date = new Date(timeStr);
    const today = new Date();
    if (date.toDateString() === today.toDateString()) {
      return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    today.setDate(today.getDate() - 1);
    if (date.toDateString() === today.toDateString()) {
      return "Yesterday";
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const totalUnread = chats.reduce((sum, c) => sum + (c.unreadCount || 0), 0);

  return (
    <div className="flex flex-col h-full bg-background relative">
      <header className="px-4 py-3 border-b border-border bg-card sticky top-0 z-10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-primary hover:text-primary/80 transition-colors p-1 -ml-1 rounded-full hover:bg-primary/10"
            >
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-foreground leading-tight">Chats</h1>
              {session?.phone && (
                <p className="text-xs text-muted-foreground leading-tight">+{session.phone}</p>
              )}
            </div>
          </div>

          {/* Status button */}
          <Link
            href={`/sessions/${sessionId}/status`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary transition-colors"
          >
            <CircleDot className="w-4 h-4" />
            <span className="text-sm font-medium">Status</span>
          </Link>
        </div>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-secondary/50 text-foreground rounded-xl py-2 pl-9 pr-4 outline-none text-sm placeholder:text-muted-foreground focus:bg-secondary focus:ring-1 focus:ring-primary transition-all"
          />
        </div>
      </header>

      <main className="flex-1 overflow-y-auto scrollbar-none">
        {isLoading ? (
          <div className="flex justify-center items-center h-32">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-secondary flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">
                {search ? "No Results" : "No Chats Found"}
              </h2>
              <p className="text-sm text-muted-foreground max-w-[250px]">
                {search
                  ? `No chats matching "${search}"`
                  : "When you receive messages, they will appear here."}
              </p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {filtered.map((chat) => (
              <Link
                key={chat.id}
                href={`/sessions/${sessionId}/chats/${encodeURIComponent(chat.id)}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/50 transition-colors active:bg-secondary cursor-pointer"
              >
                <Avatar className="w-12 h-12 border border-border shrink-0">
                  <AvatarImage src={chat.profilePicture || undefined} />
                  <AvatarFallback className="bg-[#202C33] text-[#E9EDEF]">
                    {chat.isGroup ? (
                      <Users className="w-5 h-5" />
                    ) : (
                      (chat.name?.[0] || chat.phone?.[0] || "?").toUpperCase()
                    )}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="flex items-center justify-between gap-2">
                    <h3
                      className={`font-semibold truncate max-w-[180px] ${
                        chat.unreadCount > 0 ? "text-foreground" : "text-foreground/90"
                      }`}
                    >
                      {chat.name || chat.phone || chat.id.split("@")[0]}
                    </h3>
                    <span
                      className={`text-xs flex-shrink-0 ${
                        chat.unreadCount > 0 ? "text-primary font-medium" : "text-muted-foreground"
                      }`}
                    >
                      {formatTime(chat.lastMessageTime)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between mt-0.5 gap-2">
                    <p className="text-sm text-muted-foreground truncate flex-1">
                      {chat.lastMessage || "No messages"}
                    </p>
                    {chat.unreadCount > 0 && (
                      <Badge className="bg-primary text-primary-foreground h-5 min-w-[20px] px-1.5 flex items-center justify-center rounded-full text-[10px] font-bold shrink-0 border-0">
                        {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
                      </Badge>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Unread summary footer */}
      {totalUnread > 0 && (
        <div className="border-t border-border bg-card/80 px-4 py-2 flex items-center justify-center">
          <span className="text-xs text-muted-foreground">
            {totalUnread} unread {totalUnread === 1 ? "message" : "messages"}
          </span>
        </div>
      )}
    </div>
  );
}

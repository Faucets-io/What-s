import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Shield, Users, Smartphone, ChevronRight, Loader2, LogOut, RefreshCw, Wifi, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AppUser {
  id: string;
  username: string;
  sessionCount: number;
  connectedCount: number;
  createdAt: string;
}

interface Props {
  onLogout: () => void;
}

export default function MasterDashboardPage({ onLogout }: Props) {
  const [, setLocation] = useLocation();

  const { data: users = [], isLoading, refetch, isFetching } = useQuery<AppUser[]>({
    queryKey: ["auth-users"],
    queryFn: async () => {
      const token = localStorage.getItem("wa_monitor_token");
      const res = await fetch("/api/auth/users", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 10_000,
  });

  const totalSessions = users.reduce((s, u) => s + u.sessionCount, 0);
  const totalConnected = users.reduce((s, u) => s + u.connectedCount, 0);

  return (
    <div className="flex flex-col h-full bg-background relative">
      {/* Header */}
      <header className="px-4 pt-4 pb-3 border-b border-border bg-card/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center">
              <Shield className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h1 className="text-[15px] font-bold text-foreground leading-tight">Master Dashboard</h1>
              <p className="text-[11px] text-primary leading-none">master account</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => refetch()}
              disabled={isFetching}
              className="w-9 h-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={onLogout}
              className="w-9 h-9 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              title="Sign out"
            >
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto scrollbar-none">
        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-2 p-4">
          {[
            { label: "Users", value: users.length, icon: Users, color: "text-blue-400" },
            { label: "Sessions", value: totalSessions, icon: Smartphone, color: "text-primary" },
            { label: "Connected", value: totalConnected, icon: Wifi, color: "text-emerald-400" },
          ].map((stat) => (
            <div key={stat.label} className="bg-card rounded-2xl border border-border px-3 py-3 flex flex-col items-center gap-1">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
              <span className="text-xl font-bold text-foreground">{stat.value}</span>
              <span className="text-[11px] text-muted-foreground">{stat.label}</span>
            </div>
          ))}
        </div>

        {/* User list */}
        <div className="px-4 pb-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
            All Users
          </h2>

          {isLoading ? (
            <div className="flex justify-center items-center py-16">
              <Loader2 className="w-7 h-7 animate-spin text-primary" />
            </div>
          ) : users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <div className="w-14 h-14 rounded-full bg-secondary flex items-center justify-center">
                <Users className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">No users have signed up yet.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {users.map((user) => (
                <button
                  key={user.id}
                  onClick={() => setLocation(`/users/${user.id}`)}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl bg-card border border-border hover:bg-secondary/60 active:scale-[0.98] transition-all text-left"
                >
                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                    <span className="text-primary font-bold text-base">
                      {user.username[0].toUpperCase()}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground text-[15px] truncate">{user.username}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Smartphone className="w-3 h-3" />
                        {user.sessionCount} device{user.sessionCount !== 1 ? "s" : ""}
                      </span>
                      {user.connectedCount > 0 ? (
                        <span className="text-xs text-emerald-400 flex items-center gap-1">
                          <Wifi className="w-3 h-3" />
                          {user.connectedCount} live
                        </span>
                      ) : user.sessionCount > 0 ? (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <WifiOff className="w-3 h-3" />
                          offline
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

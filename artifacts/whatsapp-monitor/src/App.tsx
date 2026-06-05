import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import AccountsPage from "@/pages/AccountsPage";
import ChatsPage from "@/pages/ChatsPage";
import ConversationPage from "@/pages/ConversationPage";
import StatusPage from "@/pages/StatusPage";
import LoginPage from "@/pages/LoginPage";
import SignupPage from "@/pages/SignupPage";
import MasterDashboardPage from "@/pages/MasterDashboardPage";
import { useState, useEffect, createContext, useContext } from "react";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

const TOKEN_KEY = "wa_monitor_token";

// ── Auth types ────────────────────────────────────────────────────────────────
interface AuthUser {
  token: string;
  userId: string;
  username: string;
  isMaster: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  login: (token: string, userId: string, username: string, isMaster: boolean) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  login: () => {},
  logout: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

// ── Auth Provider ─────────────────────────────────────────────────────────────
function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) { setChecking(false); return; }
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.userId) {
          setUser({ token, userId: data.userId, username: data.username, isMaster: data.isMaster });
        } else {
          localStorage.removeItem(TOKEN_KEY);
        }
      })
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setChecking(false));
  }, []);

  const login = (token: string, userId: string, username: string, isMaster: boolean) => {
    localStorage.setItem(TOKEN_KEY, token);
    setUser({ token, userId, username, isMaster });
  };

  const logout = () => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      fetch("/api/auth/logout", { method: "POST", headers: { Authorization: `Bearer ${token}` } }).catch(() => {});
    }
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
    queryClient.clear();
  };

  if (checking) {
    return (
      <div className="min-h-[100dvh] w-full flex items-center justify-center bg-[#000000]">
        <Loader2 className="w-8 h-8 text-[#00a884] animate-spin" />
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Auth Gate ─────────────────────────────────────────────────────────────────
function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, login } = useAuth();
  const [page, setPage] = useState<"login" | "signup">("login");

  if (!user) {
    if (page === "signup") {
      return (
        <SignupPage
          onSignup={(token, userId, username) => login(token, userId, username, false)}
          onGoLogin={() => setPage("login")}
        />
      );
    }
    return (
      <LoginPage
        onLogin={(token, userId, username, isMaster) => login(token, userId, username, isMaster)}
        onGoSignup={() => setPage("signup")}
      />
    );
  }

  return <>{children}</>;
}

// ── Router ────────────────────────────────────────────────────────────────────
function Router() {
  const { user, logout } = useAuth();

  return (
    <div className="mx-auto w-full max-w-[390px] min-h-[100dvh] bg-background border-x border-border shadow-2xl relative flex flex-col overflow-hidden dark">
      <Switch>
        {/* Master home: user list dashboard */}
        <Route path="/" component={() =>
          user?.isMaster
            ? <MasterDashboardPage onLogout={logout} />
            : <AccountsPage onLogout={logout} currentUser={user!} userId={user!.userId} />
        } />

        {/* Master tapping a user → see that user's linked devices */}
        <Route path="/users/:userId" component={({ params }) => (
          <AccountsPage
            onLogout={logout}
            currentUser={user!}
            userId={params.userId}
            viewingUserId={params.userId}
          />
        )} />

        <Route path="/sessions/:sessionId" component={ChatsPage} />
        <Route path="/sessions/:sessionId/status" component={StatusPage} />
        <Route path="/sessions/:sessionId/chats/:chatId" component={ConversationPage} />
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <div className="min-h-[100dvh] bg-[#000000] w-full flex items-center justify-center">
              <AuthGate>
                <Router />
              </AuthGate>
            </div>
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

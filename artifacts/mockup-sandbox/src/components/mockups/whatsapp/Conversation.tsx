export function Conversation() {
  const messages = [
    { id: 1, text: "Hey! Are you free this weekend?", sent: false, time: "10:20 AM", status: null },
    { id: 2, text: "Yeah! What did you have in mind? 😊", sent: true, time: "10:22 AM", status: "read" },
    { id: 3, text: "Thinking about going to the beach. The weather is supposed to be amazing!", sent: false, time: "10:23 AM", status: null },
    { id: 4, text: "That sounds awesome! I'm totally in 🏖️", sent: true, time: "10:24 AM", status: "read" },
    { id: 5, text: "Great! Let me check the best spots", sent: false, time: "10:25 AM", status: null },
    { id: 6, text: "Also should we invite the others?", sent: false, time: "10:25 AM", status: null },
    { id: 7, text: "Definitely, the more the merrier!", sent: true, time: "10:27 AM", status: "read" },
    { id: 8, text: "I'll set up a group chat 👍", sent: true, time: "10:27 AM", status: "delivered" },
    { id: 9, text: "Perfect! Can't wait 🎉", sent: false, time: "10:30 AM", status: null },
  ];

  const DoubleCheck = ({ color = "#53BDEB" }: { color?: string }) => (
    <svg width="16" height="10" viewBox="0 0 16 10">
      <path d="M1 5l3 3L10 1" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 5l3 3L14 1" stroke={color} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  const SingleCheck = () => (
    <svg width="12" height="10" viewBox="0 0 12 10">
      <path d="M1 5l3 3L11 1" stroke="#667781" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", height: "100vh", display: "flex", flexDirection: "column", maxWidth: 390, margin: "0 auto", overflow: "hidden", position: "relative" }}>
      {/* Header */}
      <div style={{ background: "#008069", padding: "8px 12px", display: "flex", alignItems: "center", gap: 10, zIndex: 10 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        <div style={{ width: 38, height: 38, borderRadius: "50%", background: "#4ECDC4", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 15 }}>
          JD
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "#fff", fontWeight: 600, fontSize: 16, lineHeight: 1.2 }}>John Doe</div>
          <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 12 }}>online</div>
        </div>
        <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
          </svg>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.44 2 2 0 0 1 3.59 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16z"/>
          </svg>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="5" r="1" fill="#fff"/><circle cx="12" cy="12" r="1" fill="#fff"/><circle cx="12" cy="19" r="1" fill="#fff"/>
          </svg>
        </div>
      </div>

      {/* Chat Background */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 8px 4px", position: "relative", background: "#E5DDD5", backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23D4C8B8' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")` }}>

        {/* Date separator */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 12 }}>
          <div style={{ background: "rgba(255,255,255,0.85)", borderRadius: 8, padding: "3px 10px", fontSize: 12, color: "#667781", fontWeight: 500 }}>
            Today
          </div>
        </div>

        {messages.map((msg, idx) => {
          const prevSent = idx > 0 ? messages[idx - 1].sent : null;
          const isTail = prevSent !== msg.sent;
          return (
            <div key={msg.id} style={{ display: "flex", justifyContent: msg.sent ? "flex-end" : "flex-start", marginBottom: 2 }}>
              <div style={{
                maxWidth: "75%",
                background: msg.sent ? "#D9FDD3" : "#fff",
                borderRadius: msg.sent
                  ? isTail ? "12px 2px 12px 12px" : "12px 12px 12px 12px"
                  : isTail ? "2px 12px 12px 12px" : "12px 12px 12px 12px",
                padding: "6px 10px 6px 10px",
                boxShadow: "0 1px 2px rgba(0,0,0,0.13)",
                position: "relative",
                marginBottom: 2,
              }}>
                {isTail && msg.sent && (
                  <div style={{ position: "absolute", top: 0, right: -6, width: 0, height: 0, borderLeft: "6px solid #D9FDD3", borderBottom: "6px solid transparent" }} />
                )}
                {isTail && !msg.sent && (
                  <div style={{ position: "absolute", top: 0, left: -6, width: 0, height: 0, borderRight: "6px solid #fff", borderBottom: "6px solid transparent" }} />
                )}
                <span style={{ fontSize: 14.5, color: "#111B21", lineHeight: 1.45, display: "block", paddingRight: msg.sent ? 36 : 28 }}>
                  {msg.text}
                </span>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 3, marginTop: 1 }}>
                  <span style={{ fontSize: 11, color: "#667781" }}>{msg.time}</span>
                  {msg.sent && (
                    msg.status === "read" ? <DoubleCheck color="#53BDEB" /> :
                    msg.status === "delivered" ? <DoubleCheck color="#667781" /> :
                    <SingleCheck />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input Bar */}
      <div style={{ background: "#F0F2F5", padding: "6px 8px", display: "flex", alignItems: "center", gap: 6 }}>
        <div style={{ flex: 1, background: "#fff", borderRadius: 24, display: "flex", alignItems: "center", padding: "8px 14px", gap: 10, minHeight: 44 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8696A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
          </svg>
          <span style={{ flex: 1, color: "#8696A0", fontSize: 15 }}>Message</span>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8696A0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
          </svg>
        </div>
        <div style={{ width: 46, height: 46, background: "#25D366", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 2px 6px rgba(0,0,0,0.2)" }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/>
          </svg>
        </div>
      </div>
    </div>
  );
}

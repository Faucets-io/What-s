export function LinkedDevices() {
  const sessions = [
    { id: 1, name: "+1 234 567 8901", status: "Connected", lastSeen: "Active now", avatar: "JD", color: "#4ECDC4" },
    { id: 2, name: "+44 7700 900123", status: "Connected", lastSeen: "Active now", avatar: "SW", color: "#FF6B6B" },
    { id: 3, name: "+91 98765 43210", status: "Disconnected", lastSeen: "Last seen 2h ago", avatar: "MK", color: "#96CEB4" },
  ];

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: "#F0F2F5", height: "100vh", display: "flex", flexDirection: "column", maxWidth: 390, margin: "0 auto", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ background: "#008069", padding: "10px 16px 12px", display: "flex", alignItems: "center", gap: 14 }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        <span style={{ color: "#fff", fontSize: 20, fontWeight: 600 }}>WhatsApp Monitor</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 16 }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="5" r="1" fill="#fff"/><circle cx="12" cy="12" r="1" fill="#fff"/><circle cx="12" cy="19" r="1" fill="#fff"/>
          </svg>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {/* Link a device button */}
        <div style={{ background: "#fff", margin: "12px 0 0", borderTop: "1px solid #E9EDEF", borderBottom: "1px solid #E9EDEF" }}>
          <div style={{ display: "flex", alignItems: "center", padding: "14px 16px", gap: 16, cursor: "pointer" }}>
            <div style={{ width: 44, height: 44, background: "#F0F2F5", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#008069" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
              </svg>
            </div>
            <div>
              <div style={{ fontSize: 16, color: "#008069", fontWeight: 600 }}>Link a Device</div>
              <div style={{ fontSize: 13, color: "#667781", marginTop: 1 }}>Scan QR or use phone number</div>
            </div>
            <svg style={{ marginLeft: "auto" }} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C4C4C4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>
        </div>

        {/* Linked Devices Section */}
        <div style={{ padding: "20px 16px 8px" }}>
          <span style={{ fontSize: 13, color: "#008069", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Linked Accounts ({sessions.length})
          </span>
        </div>

        <div style={{ background: "#fff", borderTop: "1px solid #E9EDEF", borderBottom: "1px solid #E9EDEF" }}>
          {sessions.map((session, idx) => (
            <div key={session.id}>
              <div style={{ display: "flex", alignItems: "center", padding: "12px 16px", gap: 14 }}>
                <div style={{ position: "relative" }}>
                  <div style={{ width: 48, height: 48, borderRadius: "50%", background: session.color, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 17 }}>
                    {session.avatar}
                  </div>
                  <div style={{ position: "absolute", bottom: 1, right: 1, width: 13, height: 13, borderRadius: "50%", background: session.status === "Connected" ? "#25D366" : "#9E9E9E", border: "2px solid #fff" }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 16, color: "#111B21", fontWeight: 600 }}>{session.name}</div>
                  <div style={{ fontSize: 13, color: session.status === "Connected" ? "#25D366" : "#667781", marginTop: 2 }}>{session.lastSeen}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: session.status === "Connected" ? "#25D366" : "#9E9E9E", background: session.status === "Connected" ? "#E8FBF0" : "#F0F2F5", padding: "2px 8px", borderRadius: 10 }}>
                    {session.status}
                  </span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C4C4C4" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </div>
              </div>
              {idx < sessions.length - 1 && <div style={{ height: 1, background: "#F0F2F5", marginLeft: 78 }} />}
            </div>
          ))}
        </div>

        {/* Info box */}
        <div style={{ margin: 16, background: "#fff", borderRadius: 10, padding: 16, border: "1px solid #E9EDEF" }}>
          <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#008069" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <div>
              <div style={{ fontSize: 14, color: "#111B21", fontWeight: 600, marginBottom: 4 }}>Monitor Multiple Accounts</div>
              <div style={{ fontSize: 13, color: "#667781", lineHeight: 1.5 }}>
                Link WhatsApp accounts to monitor messages, chats, and status updates in real time.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Nav */}
      <div style={{ background: "#fff", borderTop: "1px solid #E9EDEF", display: "flex", justifyContent: "space-around", padding: "8px 0 12px" }}>
        {[
          { icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z", label: "Chats" },
          { icon: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.44 2 2 0 0 1 3.59 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 6 6l.92-.92a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.73 16z", label: "Accounts", active: true },
          { icon: "M12 20h9 M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z", label: "Status" },
        ].map((item) => (
          <div key={item.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "4px 20px" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={item.active ? "#008069" : "#667781"} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d={item.icon}/>
            </svg>
            <span style={{ fontSize: 11, color: item.active ? "#008069" : "#667781", fontWeight: item.active ? 600 : 400 }}>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

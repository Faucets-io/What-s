export function ChatsList() {
  const chats = [
    { id: 1, name: "John Doe", message: "Hey, are you there?", time: "10:42 AM", unread: 3, avatar: "JD", online: true },
    { id: 2, name: "Sarah Wilson", message: "Voice message", time: "10:15 AM", unread: 0, avatar: "SW", online: false, voiceNote: true },
    { id: 3, name: "Family Group 👨‍👩‍👧‍👦", message: "Dad: Dinner at 7pm!", time: "9:58 AM", unread: 12, avatar: "FG", online: false },
    { id: 4, name: "Mike Johnson", message: "Photo", time: "Yesterday", unread: 0, avatar: "MJ", online: true, photo: true },
    { id: 5, name: "Work Team", message: "You: See you Monday", time: "Yesterday", unread: 0, avatar: "WT", online: false, sent: true },
    { id: 6, name: "Emma Davis", message: "😂😂😂 so funny!", time: "Yesterday", unread: 1, avatar: "ED", online: false },
    { id: 7, name: "Alex Brown", message: "Ok sounds good 👍", time: "Mon", unread: 0, avatar: "AB", online: false },
    { id: 8, name: "Lisa Chen", message: "Can we reschedule?", time: "Mon", unread: 0, avatar: "LC", online: true },
    { id: 9, name: "Tom Martinez", message: "Thanks!", time: "Sun", unread: 0, avatar: "TM", online: false },
    { id: 10, name: "Best Friends 🎉", message: "Nina: Let's gooo!!", time: "Sat", unread: 5, avatar: "BF", online: false },
  ];

  const avatarColors = [
    "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
    "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9"
  ];

  return (
    <div style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", background: "#F0F2F5", height: "100vh", display: "flex", flexDirection: "column", maxWidth: 390, margin: "0 auto", overflow: "hidden" }}>
      {/* Header */}
      <div style={{ background: "#008069", padding: "10px 16px 8px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ color: "#fff", fontSize: 22, fontWeight: 700, letterSpacing: 0.3 }}>WhatsApp</span>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="5" r="1" fill="#fff"/><circle cx="12" cy="12" r="1" fill="#fff"/><circle cx="12" cy="19" r="1" fill="#fff"/>
          </svg>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: "#008069", display: "flex", borderBottom: "none" }}>
        {["All", "Unread", "Favourites", "Groups"].map((tab, i) => (
          <div key={tab} style={{ flex: i === 0 ? "none" : 1, padding: "8px 16px", fontSize: 13, fontWeight: i === 0 ? 700 : 500, color: i === 0 ? "#fff" : "rgba(255,255,255,0.7)", borderBottom: i === 0 ? "2px solid #fff" : "2px solid transparent", textAlign: "center", whiteSpace: "nowrap" }}>
            {tab}
          </div>
        ))}
      </div>

      {/* Search */}
      <div style={{ padding: "8px 12px", background: "#F0F2F5" }}>
        <div style={{ background: "#fff", borderRadius: 8, display: "flex", alignItems: "center", padding: "7px 12px", gap: 10 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#667781" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <span style={{ color: "#8696A0", fontSize: 15 }}>Search...</span>
        </div>
      </div>

      {/* Chat List */}
      <div style={{ flex: 1, overflowY: "auto", background: "#fff" }}>
        {chats.map((chat, idx) => (
          <div key={chat.id} style={{ display: "flex", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid #F0F2F5", gap: 12, background: "#fff" }}>
            {/* Avatar */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <div style={{ width: 50, height: 50, borderRadius: "50%", background: avatarColors[idx % avatarColors.length], display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 17 }}>
                {chat.avatar}
              </div>
              {chat.online && (
                <div style={{ position: "absolute", bottom: 2, right: 2, width: 12, height: 12, background: "#25D366", borderRadius: "50%", border: "2px solid #fff" }} />
              )}
            </div>
            {/* Content */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 }}>
                <span style={{ fontWeight: 600, fontSize: 16, color: "#111B21", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{chat.name}</span>
                <span style={{ fontSize: 12, color: chat.unread > 0 ? "#25D366" : "#667781", flexShrink: 0 }}>{chat.time}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>
                  {chat.sent && (
                    <svg width="16" height="10" viewBox="0 0 16 10" style={{ flexShrink: 0 }}>
                      <path d="M1 5l3 3L10 1" stroke="#53BDEB" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M5 5l3 3L14 1" stroke="#53BDEB" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                  {chat.voiceNote && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#667781" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/>
                    </svg>
                  )}
                  {chat.photo && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#667781" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
                    </svg>
                  )}
                  <span style={{ fontSize: 14, color: "#667781", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {chat.voiceNote ? "Voice message" : chat.photo ? "Photo" : chat.message}
                  </span>
                </div>
                {chat.unread > 0 && (
                  <div style={{ background: "#25D366", color: "#fff", borderRadius: 10, minWidth: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, padding: "0 5px", flexShrink: 0 }}>
                    {chat.unread}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* FAB */}
      <div style={{ position: "absolute", bottom: 24, right: 24, width: 56, height: 56, background: "#25D366", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.25)" }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
      </div>
    </div>
  );
}

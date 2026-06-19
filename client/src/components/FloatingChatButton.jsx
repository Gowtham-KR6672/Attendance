import React, { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { api } from "../api";
import { LuMessageCircleMore } from "react-icons/lu";
import { socket } from "../socket";

export default function FloatingChatWidget() {
  const [open, setOpen] = useState(false);

  // 🔴 unread indicator (dot)
  const [unreadCount, setUnreadCount] = useState(0);

  const [users, setUsers] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  const token = localStorage.getItem("token");
  const myId = localStorage.getItem("adminId");
  const myRole = localStorage.getItem("role");

  const listRef = useRef(null);

const socket = useMemo(() => {
  const SOCKET_URL =
    import.meta.env.VITE_SOCKET_URL || "http://localhost:4000";

  return io(SOCKET_URL, {
    auth: { token },
    withCredentials: true,
    transports: ["websocket", "polling"],
  });
}, [token]);


  const scrollToBottom = () => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };

  // ✅ 20% width & 30% height + safe limits
  const panelStyle = {
    width: "40vw",
    height: "80vh",
    minWidth: 340,
    minHeight: 320,
    maxWidth: 520,
    maxHeight: 520,
  };

  const ruleText = "Only Chat — don't share files here....";

  const normalizeId = (v) => (v == null ? "" : String(v));

  const loadUsers = async () => {
    const { data } = await api.get("/chat/users");
    const arr = Array.isArray(data) ? data.filter((u) => u && (u._id || u.id)) : [];
    const normalized = arr.map((u) => ({ ...u, _id: u._id || u.id }));
    setUsers(normalized);

    if (!activeUser && normalized.length) {
      setActiveUser(normalized[0]);
    }
  };

  const loadMessages = async (otherId) => {
    const { data } = await api.get(`/chat/messages/${otherId}`);
    console.log("[Chat] Loaded from DB:", data?.length || 0, "messages");
    const list = Array.isArray(data) ? data : [];

    // ✅ dedupe by _id
    const seen = new Set();
    const unique = list.filter((m) => {
      if (!m._id) return true;
      if (seen.has(m._id)) return false;
      seen.add(m._id);
      return true;
    });

    // ✅ attach a default status if missing
    const withStatus = unique.map((m) => ({
      ...m,
      status: m.status || "delivered",
    }));

    setMessages(withStatus);

    setTimeout(scrollToBottom, 50);
  };

  useEffect(() => {
    loadUsers();
    return () => socket.disconnect();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (activeUser?._id) loadMessages(activeUser._id);
    // eslint-disable-next-line
  }, [activeUser?._id]);

  // ✅ Clear unread dot when chat opens
  useEffect(() => {
    if (open) setUnreadCount(0);
  }, [open]);

  // ✅ SOCKET RECEIVE (dedupe + unread + status handling)
  useEffect(() => {
    const handler = (msg) => {
      const toId = normalizeId(msg?.toAdminId);
      const fromId = normalizeId(msg?.fromAdminId);
      const meId = normalizeId(myId);
      const otherId = normalizeId(activeUser?._id);

      // ✅ unread logic:
      // If chat is closed and message is for me → unread dot
      // If chat is open but I'm not on that conversation → unread dot
      const isIncomingForMe = toId === meId;
      const isViewingThisChat =
        otherId &&
        ((fromId === otherId && toId === meId) || (fromId === meId && toId === otherId));

      if (isIncomingForMe && (!open || !isViewingThisChat)) {
        setUnreadCount((n) => n + 1);
      }

      // only append if it belongs to current chat window
      if (!otherId) return;

      const belongs =
        (fromId === meId && toId === otherId) ||
        (fromId === otherId && toId === meId);

      if (!belongs) return;

      setMessages((prev) => {
        // ✅ prevent duplicates by _id
        if (msg?._id && prev.some((m) => m._id === msg._id)) return prev;

        // ✅ remove optimistic duplicate if real msg comes
        const cleaned = prev.filter((m) => {
          const mid = normalizeId(m._id);
          if (!mid.startsWith("tmp-")) return true;

          const sameDir =
            normalizeId(m.fromAdminId) === fromId &&
            normalizeId(m.toAdminId) === toId;

          const sameText = (m.text || "").trim() === (msg.text || "").trim();

          if (!sameDir || !sameText) return true;

          const t1 = new Date(m.createdAt).getTime();
          const t2 = new Date(msg.createdAt).getTime();
          if (isNaN(t1) || isNaN(t2)) return true;

          // if within 10 seconds, treat as same message
          return Math.abs(t2 - t1) > 10000;
        });

        // ✅ set status:
        // If it is incoming and chat is open & viewing → read
        let status = msg.status || "delivered";
        if (open && isIncomingForMe && isViewingThisChat) status = "read";

        return [...cleaned, { ...msg, status }];
      });

      setTimeout(scrollToBottom, 50);
    };

    socket.on("chat:new", handler);
    return () => socket.off("chat:new", handler);
  }, [socket, activeUser?._id, myId, open]);

  // ✅ when user switches activeUser while open, treat visible incoming as read
  useEffect(() => {
    if (!open || !activeUser?._id) return;

    const otherId = normalizeId(activeUser._id);
    const meId = normalizeId(myId);

    setMessages((prev) =>
      prev.map((m) => {
        const fromId = normalizeId(m.fromAdminId);
        const toId = normalizeId(m.toAdminId);

        const isIncomingThisChat = fromId === otherId && toId === meId;
        if (!isIncomingThisChat) return m;

        // mark as read
        if (m.status !== "read") return { ...m, status: "read" };
        return m;
      })
    );
  }, [open, activeUser?._id, myId]);

  const send = () => {
    if (!activeUser?._id) return;

    const t = text.trim();
    if (!t) return;

    const tempId = `tmp-${Date.now()}`;
    const optimistic = {
      _id: tempId,
      fromAdminId: myId,
      toAdminId: activeUser._id,
      text: t,
      createdAt: new Date().toISOString(),
      status: "sent", // ✅ sent immediately
    };

    setMessages((prev) => [...prev, optimistic]);
    setText("");
    setTimeout(scrollToBottom, 50);

    socket.emit("chat:send", { toAdminId: activeUser._id, text: t }, (resp) => {
      if (!resp?.ok) {
        alert(resp?.message || "Send failed");
        setMessages((prev) => prev.filter((m) => m._id !== tempId));
        return;
      }

      // ✅ mark optimistic as delivered (until server pushes real msg)
      setMessages((prev) =>
        prev.map((m) => (m._id === tempId ? { ...m, status: "delivered" } : m))
      );
    });
  };

  const statusLabel = (m) => {
    if (normalizeId(m.fromAdminId) !== normalizeId(myId)) return "";
    if (m.status === "read") return "✓✓ Read";
    if (m.status === "delivered") return "✓ Delivered";
    return "⏳ Sent";
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        title="Chat"
        style={{
          position: "fixed",
          left: 20,
          bottom: 20,
          width: 56,
          height: 56,
          borderRadius: 999,
          background: "#0544daff",
          color: "#fff",
          border: "none",
          cursor: "pointer",
          zIndex: 9999,
          boxShadow: "0 10px 25px rgba(0,0,0,.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 22,
        }}
      >
        <LuMessageCircleMore />

        {/* 🔴 unread dot */}
        {unreadCount > 0 && (
          <span
            title={`${unreadCount} new`}
            style={{
              position: "absolute",
              top: 10,
              right: 10,
              width: 12,
              height: 12,
              borderRadius: 999,
              background: "red",
              border: "2px solid #fff",
            }}
          />
        )}
      </button>

      {/* Panel */}
      {open && (
        <div
          style={{
            position: "fixed",
            left: 25,
            bottom: 90,
            zIndex: 9999,
            background: "#fff",
            borderRadius: 12,
            border: "1px solid #e5e7eb",
            boxShadow: "0 12px 35px rgba(0,0,0,.18)",
            overflow: "hidden",
            ...panelStyle,
          }}
        >
          {/* Header */}
          <div
            style={{
              height: 44,
              padding: "0 10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid #e5e7eb",
              background: "#f9fafb",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            <div>Chat</div>

            <button
              onClick={() => setOpen(false)}
              title="Close"
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                background: "#fff",
                cursor: "pointer",
                lineHeight: "26px",
              }}
            >
              ✕
            </button>
          </div>

          <div style={{ display: "flex", height: "calc(100% - 44px)" }}>
            {/* Users */}
            <div
              style={{
                width: 140,
                borderRight: "1px solid #e5e7eb",
                padding: 8,
                overflow: "auto",
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>
                Users
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {users.map((u) => (
                  <button
                    key={u._id}
                    onClick={() => setActiveUser(u)}
                    style={{
                      textAlign: "left",
                      padding: "8px 8px",
                      borderRadius: 10,
                      border: "1px solid #e5e7eb",
                      background: activeUser?._id === u._id ? "#0f172a" : "#fff",
                      color: activeUser?._id === u._id ? "#fff" : "#111",
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 600,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {u.email}
                    </div>
                    <div style={{ fontSize: 10, opacity: 0.7 }}>{u.role}</div>
                  </button>
                ))}
                {!users.length && (
                  <div style={{ fontSize: 12, opacity: 0.7 }}>No users</div>
                )}
              </div>

              <div style={{ fontSize: 10, opacity: 0.7, marginTop: 10 }}>
                {ruleText}
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <div style={{ padding: 8, fontSize: 12, fontWeight: 700 }}>
                {activeUser ? `Chat: ${activeUser.email}` : "Select user"}
              </div>

              <div
                ref={listRef}
                style={{
                  flex: 1,
                  padding: 8,
                  overflow: "auto",
                  borderTop: "1px solid #f3f4f6",
                  borderBottom: "1px solid #f3f4f6",
                }}
              >
                {messages.map((m) => {
                  const mine = normalizeId(m.fromAdminId) === normalizeId(myId);
                  return (
                    <div
                      key={m._id || `${m.fromAdminId}-${m.createdAt}`}
                      style={{ marginBottom: 8 }}
                    >
                      <div
                        style={{
                          maxWidth: "85%",
                          marginLeft: mine ? "auto" : 0,
                          background: mine ? "#111827" : "#f3f4f6",
                          color: mine ? "#fff" : "#111",
                          padding: "8px 10px",
                          borderRadius: 10,
                          fontSize: 12,
                        }}
                      >
                        <div>{m.text}</div>

                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 8,
                            fontSize: 10,
                            opacity: 0.7,
                            marginTop: 3,
                          }}
                        >
                          <span>{new Date(m.createdAt).toLocaleString()}</span>
                          <span>{statusLabel(m)}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {!messages.length && (
                  <div style={{ fontSize: 12, opacity: 0.7 }}>
                    No messages yet
                  </div>
                )}
              </div>

              <div style={{ padding: 8, display: "flex", gap: 8 }}>
                <input
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder="Type..."
                  disabled={!activeUser}
                  style={{
                    flex: 1,
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    padding: "8px 10px",
                    fontSize: 12,
                  }}
                />
                <button
                  onClick={send}
                  disabled={!activeUser}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: "none",
                    background: "#0f172a",
                    color: "#fff",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

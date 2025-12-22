import React, { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { api } from "../api";
import { X } from "lucide-react";
import { socket } from "../socket";


export default function Chat({ open, setOpen, setUnreadOutside }) {
  const [users, setUsers] = useState([]);
  const [activeUser, setActiveUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [unread, setUnread] = useState(0);

  const token = localStorage.getItem("token");
  const myId = localStorage.getItem("adminId");

  const socket = useMemo(() => {
  const SOCKET_URL =
    import.meta.env.VITE_SOCKET_URL || "http://localhost:4000";

  return io(SOCKET_URL, {
    auth: { token },
    withCredentials: true,
    transports: ["websocket", "polling"],
  });
}, [token]);


  // ✅ load unread count from backend
  const loadUnread = async () => {
    const { data } = await api.get("/chat/unread-count");
    setUnread(data?.unread || 0);
    setUnreadOutside?.(data?.unread || 0);
  };

  const loadUsers = async () => {
    const { data } = await api.get("/chat/users");
    const arr = Array.isArray(data) ? data : [];
    const normalized = arr.map((u) => ({ ...u, _id: u._id || u.id }));
    setUsers(normalized);
    if (!activeUser && normalized.length) setActiveUser(normalized[0]);
  };

  const loadMessages = async (otherId) => {
    const { data } = await api.get(`/chat/messages/${otherId}`);
    const list = Array.isArray(data) ? data : [];
    const seen = new Set();
    const unique = list.filter((m) => {
      if (!m._id) return true;
      if (seen.has(m._id)) return false;
      seen.add(m._id);
      return true;
    });
    setMessages(unique);
  };

  // ✅ mark read when chat is open and active user set
  const markRead = async (otherId) => {
    if (!otherId) return;
    socket.emit("chat:read", { otherId }, () => {});
    await loadUnread();
  };

  useEffect(() => {
    loadUsers();
    loadUnread();
    return () => socket.disconnect();
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (activeUser?._id) {
      loadMessages(activeUser._id);
      if (open) markRead(activeUser._id);
    }
    // eslint-disable-next-line
  }, [activeUser?._id, open]);

  // ✅ SOCKET RECEIVE NEW MESSAGE (dedupe + unread red dot)
  useEffect(() => {
    const handler = (msg) => {
      // ✅ prevent duplicates
      setMessages((prev) => {
        if (msg._id && prev.some((m) => m._id === msg._id)) return prev;
        return [...prev, msg];
      });

      const isForMe = msg.toAdminId === myId;
      const isCurrentChat = activeUser?._id && (
        (msg.fromAdminId === activeUser._id && msg.toAdminId === myId) ||
        (msg.fromAdminId === myId && msg.toAdminId === activeUser._id)
      );

      // ✅ if chat closed OR not current chat => increase unread
      if (isForMe && (!open || !isCurrentChat)) {
        setUnread((u) => {
          const next = u + 1;
          setUnreadOutside?.(next);
          return next;
        });
      }

      // ✅ if chat open and message belongs to active chat => mark read
      if (open && isForMe && isCurrentChat) {
        markRead(activeUser._id);
      }
    };

    socket.on("chat:new", handler);

    // ✅ delivered update
    const deliveredHandler = ({ messageId }) => {
      setMessages((prev) =>
        prev.map((m) => (String(m._id) === String(messageId) ? { ...m, status: "delivered" } : m))
      );
    };
    socket.on("chat:delivered", deliveredHandler);

    // ✅ read update
    const readHandler = () => {
      // when other reads, update my sent messages status
      setMessages((prev) =>
        prev.map((m) => (m.fromAdminId === myId ? { ...m, status: "read" } : m))
      );
    };
    socket.on("chat:read", readHandler);

    return () => {
      socket.off("chat:new", handler);
      socket.off("chat:delivered", deliveredHandler);
      socket.off("chat:read", readHandler);
    };
  }, [socket, activeUser?._id, myId, open]);

  const send = () => {
    if (!activeUser?._id) return;
    const t = text.trim();
    if (!t) return;

    setText("");

    socket.emit("chat:send", { toAdminId: activeUser._id, text: t }, (resp) => {
      if (!resp?.ok) alert(resp?.message || "Send failed");
    });
  };

  // ✅ floating widget size: 20% width and 30% height
  if (!open) return null;

  return (
    <div
      className="fixed bottom-20 left-6 bg-white border rounded-xl shadow-lg flex flex-col"
      style={{
        width: "20vw",
        height: "30vh",
        minWidth: 320,
        minHeight: 260,
        zIndex: 9999,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-2 border-b">
        <div className="font-semibold text-sm">Chat</div>
        <button onClick={() => setOpen(false)} className="p-1">
          <X size={18} />
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Users */}
        <div className="w-40 border-r overflow-auto p-2">
          {users.map((u) => (
            <button
              key={u._id}
              onClick={() => setActiveUser(u)}
              className={`w-full text-left px-2 py-1 rounded mb-1 ${
                activeUser?._id === u._id ? "bg-gray-200" : "hover:bg-gray-100"
              }`}
            >
              <div className="text-xs font-medium">{u.email}</div>
              <div className="text-[10px] text-gray-500">{u.role}</div>
            </button>
          ))}
        </div>

        {/* Messages */}
        <div className="flex-1 flex flex-col">
          <div className="flex-1 overflow-auto p-2">
            {messages.map((m) => {
              const mine = m.fromAdminId === myId;
              return (
                <div key={m._id} className="mb-2">
                  <div
                    className="inline-block px-2 py-1 rounded text-xs"
                    style={{
                      maxWidth: "85%",
                      marginLeft: mine ? "auto" : 0,
                      display: "block",
                      background: mine ? "#111827" : "#f3f4f6",
                      color: mine ? "#fff" : "#111",
                    }}
                  >
                    {m.text}
                    <div className="text-[10px]" style={{ opacity: 0.7 }}>
                      {new Date(m.createdAt).toLocaleTimeString()}
                      {mine && (
                        <span style={{ marginLeft: 8 }}>
                          {m.status === "sent" ? "✓" : m.status === "delivered" ? "✓✓" : "✓✓ (Read)"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Input */}
          <div className="p-2 border-t flex gap-2">
            <input
              className="border rounded px-2 py-1 w-full text-sm"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Type..."
            />
            <button className="bg-black text-white px-3 rounded" onClick={send}>
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

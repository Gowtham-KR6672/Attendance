// client/src/App.jsx
import React, { useEffect, useState, useCallback } from "react";
import { Routes, Route, useNavigate, Navigate } from "react-router-dom";
import { api } from "./api";
import Topbar from "./components/Topbar";
import ProtectedRoute from "./components/ProtectedRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Chat from "./pages/Chat";
import FloatingChatButton from "./components/FloatingChatButton";

export default function App() {
  const navigate = useNavigate();

  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ Chat UI state
  const [chatOpen, setChatOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  // Centralized logout
  const clearAuth = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("scope");
    localStorage.removeItem("email");
    localStorage.removeItem("me");
    localStorage.removeItem("adminId");
    delete api.defaults.headers?.common?.Authorization;
    setAdmin(null);
    setChatOpen(false);
    setUnread(0);
    navigate("/login", { replace: true });
  }, [navigate]);

  // Auto-logout on 401 responses
  useEffect(() => {
    const id = api.interceptors.response.use(
      (res) => res,
      (err) => {
        if (err?.response?.status === 401) {
          clearAuth();
        }
        return Promise.reject(err);
      }
    );
    return () => api.interceptors.response.eject(id);
  }, [clearAuth]);

  // Load current admin (only if token exists)
  const fetchMe = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      setAdmin(null);
      setLoading(false);
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setAdmin(data);

      // ✅ store adminId so chat can use it
      if (data?.id) localStorage.setItem("adminId", data.id);
      if (data?._id) localStorage.setItem("adminId", data._id);
      if (data?.email) localStorage.setItem("email", data.email);
      if (data?.role) localStorage.setItem("role", data.role);
    } catch {
      setAdmin(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  if (loading) {
    return <div className="min-h-screen grid place-items-center">Loading…</div>;
  }

  return (
    <div>
      {admin && <Topbar admin={admin} onLogout={clearAuth} />}

      <Routes>
        <Route
          path="/login"
          element={
            admin ? (
              <Navigate to="/" replace />
            ) : (
              <Login
                onAuthed={async () => {
                  await fetchMe();
                  navigate("/", { replace: true });
                }}
              />
            )
          }
        />

        <Route
          path="/"
          element={
            <ProtectedRoute isAuthed={!!admin}>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* keep /chat route if you still want it */}
        <Route
          path="/chat"
          element={
            <ProtectedRoute isAuthed={!!admin}>
              <Chat
                open={true}
                setOpen={() => {}}
                setUnreadOutside={setUnread}
                embeddedFullPage={true}
              />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to={admin ? "/" : "/login"} replace />} />
      </Routes>

      {/* ✅ Floating Chat (popup) */}
      {!!admin && (
        <>
          <FloatingChatButton open={chatOpen} setOpen={setChatOpen} unread={unread} />

          {chatOpen && (
            <div
              className="fixed bottom-24 left-6 bg-white border rounded-xl shadow-xl"
              style={{ width: "20vw", height: "30vh", zIndex: 9999, minWidth: 320, minHeight: 320 }}
            >
              <Chat open={chatOpen} setOpen={setChatOpen} setUnreadOutside={setUnread} />
            </div>
          )}
        </>
      )}
    </div>
  );
}

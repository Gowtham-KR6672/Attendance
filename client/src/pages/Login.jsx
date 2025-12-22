import React, { useEffect, useState } from "react";
import axios from "axios";
import { api } from "../api";
import { Eye, EyeOff } from "lucide-react";

export default function Login() {
  const [hasSuper, setHasSuper] = useState(true);
  const [view, setView] = useState("login"); // 'login' | 'setup'

  // Shared
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // ✅ NEW: show/hide password
  const [showPassword, setShowPassword] = useState(false);

  // ✅ Public request (NO interceptors) to avoid auto-logout loop
  const publicGetHasSuper = async () => {
    const baseURL = api?.defaults?.baseURL || "/api";
    const url = `${baseURL}/auth/has-super`;

    return axios.get(url, {
      withCredentials: true,
      headers: { "Content-Type": "application/json" },
    });
  };

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const res = await publicGetHasSuper();
        if (!mounted) return;

        const hs = !!res?.data?.hasSuper;
        setHasSuper(hs);
        setView(hs ? "login" : "setup");
      } catch {
        if (!mounted) return;
        setHasSuper(true);
        setView("login");
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const setupSuper = async (e) => {
    e.preventDefault();
    const { data } = await api.post("/auth/setup-super", { email, password });
    if (data?.ok) {
      alert("Super admin created. Please login.");
      setEmail("");
      setPassword("");
      setShowPassword(false);
      setHasSuper(true);
      setView("login");
    }
  };

  const login = async (e) => {
    e.preventDefault();
    try {
      const { data } = await api.post("/auth/login", { email, password });

      localStorage.setItem("adminId", data.id);
      localStorage.setItem("email", data.email);
      localStorage.setItem("token", data.token);
      localStorage.setItem("role", data.role);
      localStorage.setItem("scope", JSON.stringify(data.scope || {}));

      if (data?.id) localStorage.setItem("adminId", data.id);

      window.location.href = "/";
    } catch (err) {
      alert(
        err?.response?.data?.message ||
          "Login failed (401). Check email/password or backend mapping."
      );
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center">
      <div className="card w-full max-w-md">
        {!hasSuper && view === "setup" ? (
          <>
            <h2 className="font-semibold mb-3">Setup Super Admin</h2>
            <form className="space-y-3" onSubmit={setupSuper}>
              <div>
                <div className="label">Email</div>
                <input
                  className="input w-full"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              <div>
                <div className="label">Password</div>

                {/* ✅ Password with eye toggle */}
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="input w-full pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button className="btn btn-primary w-full">
                Create Super Admin
              </button>
            </form>
          </>
        ) : (
          <>
            <h2 className="font-semibold mb-3">Admin Login</h2>
            <form className="space-y-3" onSubmit={login}>
              <div>
                <div className="label">Email</div>
                <input
                  className="input w-full"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </div>

              <div>
                <div className="label">Password</div>

                {/* ✅ Password with eye toggle */}
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="input w-full pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button className="btn btn-primary w-full">Login</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

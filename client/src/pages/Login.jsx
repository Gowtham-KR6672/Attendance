import React, { useEffect, useState } from "react";
import axios from "axios";
import { api } from "../api";
import { Eye, EyeOff, LogIn } from "lucide-react";
import logoImg from "../asset/icon.png";

export default function Login({ onAuthed }) {
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

      if (onAuthed) {
        await onAuthed();
      } else {
        window.location.assign("/");
      }
    } catch (err) {
      alert(
        err?.response?.data?.message ||
        "Login failed (401). Check email/password or backend mapping."
      );
    }
  };

  return (
    <div className="login-page min-h-screen flex items-center justify-center px-4 py-8">
      <div className="login-card w-full max-w-md">
        <div className="login-icon !bg-transparent !bg-none !border-none !shadow-none overflow-visible" aria-hidden="true">
          <img src={logoImg} alt="Logo" className="w-full h-full object-cover scale-[2.5] mix-blend-multiply" />
        </div>
        {!hasSuper && view === "setup" ? (
          <>
            <div className="login-heading">
              <h1>Setup Super Admin</h1>
              <p>Create the primary account for your attendance dashboard.</p>
            </div>
            <form className="space-y-4" onSubmit={setupSuper}>
              <div>
                <label className="login-label">Email address</label>
                <input
                  type="email"
                  className="login-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="Enter your Email address"
                />
              </div>

              <div>
                <label className="login-label">Password</label>

                {/* ✅ Password with eye toggle */}
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="login-input pr-12"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    placeholder="Create a secure password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="login-eye"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button className="login-submit" type="submit">
                <span>Create Super Admin</span>
                <LogIn size={18} strokeWidth={2.25} />
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="login-heading">
              <h1>Welcome back</h1>
              <p>Sign in to manage your attendance dashboard securely.</p>
            </div>
            <form className="space-y-4" onSubmit={login}>
              <div>
                <label className="login-label">Email address</label>
                <input
                  type="email"
                  className="login-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="Enter your Email address"
                />
              </div>

              <div>
                <label className="login-label">Password</label>

                {/* ✅ Password with eye toggle */}
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    className="login-input pr-12"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="login-eye"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button className="login-submit" type="submit">
                <span>Sign in</span>
                <LogIn size={18} strokeWidth={2.25} />
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

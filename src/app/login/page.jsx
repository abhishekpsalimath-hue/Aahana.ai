"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState("signin");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("error") === "auth_callback") {
      setMode("signin");
      setMessage("We couldn't verify that link. It may have expired or already been used. Request a fresh confirmation email, then open the newest link.");
    }
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      const result = mode === "signin"
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
          });

      if (result.error) {
        const detail = result.error.message || "Please try again.";
        setMessage(mode === "signup"
          ? `We couldn't complete signup: ${detail}. If you see an email delivery error, wait before retrying.`
          : detail);
      } else if (mode === "signup" && !result.data.session) {
        setMessage("You're almost in! Open the confirmation email. After you confirm, we'll bring you straight back to Aahana and sign you in automatically.");
      } else {
        router.replace("/");
        router.refresh();
      }
    } catch (error) {
      setMessage(error?.message || "Connection problem. Please check your internet and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link className="brand auth-brand" href="/"><span className="brand-word">Aahana</span><span className="brand-ai">AI</span></Link>
        <div className="eyebrow"><span /> YOUR THINKING SPACE</div>
        <h1>{mode === "signin" ? "Welcome back." : "Start with Aahana."}</h1>
        <p className="auth-copy">{mode === "signin" ? "Sign in to return to your workspace." : "Create your account to set up your workspace."}</p>
        <form className="auth-form" onSubmit={submit}>
          <label htmlFor="email">Email address</label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          <label htmlFor="password">Password</label>
          <div className="password-field">
            <input id="password" type={showPassword ? "text" : "password"} autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" />
            <button className="password-toggle" type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>{showPassword ? "Hide" : "Show"}</button>
          </div>
          {message && <p className="auth-message" role="status">{message}</p>}
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}</button>
        </form>
        <p className="auth-switch">{mode === "signin" ? "New to Aahana?" : "Already have an account?"} <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); setShowPassword(false); }}>{mode === "signin" ? "Create account" : "Sign in"}</button></p>
        <p className="auth-legal">Your account and workspace are protected by Supabase authentication.</p>
      </section>
    </main>
  );
}

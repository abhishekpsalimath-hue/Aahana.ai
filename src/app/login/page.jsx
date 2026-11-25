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
  const [signupCooldown, setSignupCooldown] = useState(0);

  useEffect(() => {
    if (signupCooldown <= 0) return undefined;
    const timer = setTimeout(() => setSignupCooldown(seconds => Math.max(0, seconds - 1)), 1000);
    return () => clearTimeout(timer);
  }, [signupCooldown]);

  async function submit(event) {
    event.preventDefault();
    if (busy || (mode === "signup" && signupCooldown > 0)) return;
    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      const normalizedEmail = email.trim().toLowerCase();
      const result = mode === "signin"
        ? await supabase.auth.signInWithPassword({ email: normalizedEmail, password })
        : await supabase.auth.signUp({
            email: normalizedEmail,
            password,
            options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
          });

      if (result.error) {
        const rateLimited = result.error.status === 429 || result.error.code === "over_email_send_rate_limit";
        if (mode === "signup" && rateLimited) {
          setSignupCooldown(60);
          setMessage("A confirmation email was requested recently. Please wait for the countdown, then try again. Check your inbox and spam folder first.");
        } else if (mode === "signin") {
          const text = (result.error.message || "").toLowerCase();
          if (rateLimited) {
            setMessage("Too many sign-in attempts. Please wait a moment before trying again.");
          } else if (text.includes("invalid login credentials")) {
            setMessage("Email or password is incorrect. Check both and try again.");
          } else if (text.includes("email not confirmed")) {
            setMessage("Please confirm your email address using the confirmation email before signing in.");
          } else {
            setMessage("We couldn't sign you in. Please try again. If the problem continues, contact support.");
          }
        } else {
          setMessage(result.error.message || "We couldn't create your account. Please try again.");
        }
      } else if (mode === "signup" && !result.data.session) {
        setSignupCooldown(60);
        setMessage("Your signup request was received. Check your inbox and spam folder for the confirmation email before signing in.");
      } else if (mode === "signin") {
        // Verify the browser has persisted the Supabase session before leaving login.
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session) {
          setMessage("Your sign-in was accepted, but the session could not be confirmed in this browser. Please try again.");
        } else {
          // Use a full document navigation so the server receives the latest auth cookies.
          window.location.assign("/");
        }
      } else {
        window.location.assign("/");
      }
    } catch {
      setMessage("Connection problem. Check your internet connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      className="auth-shell"
      onPointerMove={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const x = ((event.clientX - bounds.left) / Math.max(1, bounds.width) - 0.5) * 18;
        const y = ((event.clientY - bounds.top) / Math.max(1, bounds.height) - 0.5) * 14;
        event.currentTarget.style.setProperty("--auth-pointer-x", `${x}px`);
        event.currentTarget.style.setProperty("--auth-pointer-y", `${y}px`);
      }}
    >
      <div className="auth-universe" aria-hidden="true">
        <span className="auth-nebula auth-nebula-one" />
        <span className="auth-nebula auth-nebula-two" />
        <span className="auth-galaxy" />
        <span className="auth-orbit auth-orbit-one" />
        <span className="auth-orbit auth-orbit-two" />
        <span className="auth-planet auth-planet-one" />
        <span className="auth-planet auth-planet-two" />
      </div>
      <section className="auth-card">
        <Link className="brand auth-brand" href="/"><span className="brand-word">Aahana</span><span className="brand-ai">AI</span></Link>
        <div className="eyebrow"><span /> YOUR THINKING SPACE</div>
        <h1>{mode === "signin" ? "Welcome back." : "Start with Aahana."}</h1>
        <p className="auth-copy">{mode === "signin" ? "Sign in to return to your workspace." : "Create your account to set up your workspace."}</p>
        <form className="auth-form" onSubmit={submit}>
          <label htmlFor="email">Email address</label>
          <input id="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck="false" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          <label htmlFor="password">Password</label>
          <div className="password-field">
            <input id="password" type={showPassword ? "text" : "password"} autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={mode === "signup" ? 8 : undefined} required value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === "signup" ? "At least 8 characters" : "Enter your password"} />
            <button className="password-toggle" type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>{showPassword ? "Hide" : "Show"}</button>
          </div>
          {mode === "signup" && <p className="auth-copy">Use at least 8 characters for your password.</p>}
          {message && <p className="auth-message" role="status" aria-live="polite">{message}</p>}
          <button className="auth-submit" type="submit" disabled={busy || (mode === "signup" && signupCooldown > 0)}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : signupCooldown > 0 ? `Try again in ${signupCooldown}s` : "Create account"}
          </button>
        </form>
        <p className="auth-switch">{mode === "signin" ? "New to Aahana?" : "Already have an account?"} <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); setShowPassword(false); setSignupCooldown(0); }}>{mode === "signin" ? "Create account" : "Sign in"}</button></p>
        <p className="auth-legal">Your account and workspace are protected by Supabase authentication.</p>
      </section>
    </main>
  );
}

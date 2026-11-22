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
  const [linkBusy, setLinkBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [signupCooldown, setSignupCooldown] = useState(0);
  const [linkCooldown, setLinkCooldown] = useState(0);

  useEffect(() => {
    if (signupCooldown <= 0) return undefined;
    const timer = setTimeout(() => setSignupCooldown(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [signupCooldown]);

  useEffect(() => {
    if (linkCooldown <= 0) return undefined;
    const timer = setTimeout(() => setLinkCooldown(value => Math.max(0, value - 1)), 1000);
    return () => clearTimeout(timer);
  }, [linkCooldown]);

  async function sendSignInLink() {
    const normalizedEmail = email.trim();
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setMessage("Enter your email address first, then request a sign-in link.");
      return;
    }
    if (linkBusy || linkCooldown > 0) return;
    setLinkBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        const limited = error.status === 429 || error.code === "over_email_send_rate_limit";
        if (limited) {
          setLinkCooldown(60);
          setMessage("A sign-in email was requested too recently. Wait for the timer before trying again, and check your inbox and spam folder.");
        } else {
          setMessage(error.message || "We couldn't send a sign-in link. Try your password instead.");
        }
      } else {
        setLinkCooldown(60);
        setMessage("If an account exists for this email, a secure sign-in link is on its way. Check your inbox and spam folder. The link can only be used once.");
      }
    } catch (error) {
      setMessage(error?.message || "Connection problem. Please check your internet and try again.");
    } finally {
      setLinkBusy(false);
    }
  }

  async function submit(event) {
    event.preventDefault();
    if (busy || (mode === "signup" && signupCooldown > 0)) return;
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
        const rateLimited = result.error.status === 429 || result.error.code === "over_email_send_rate_limit";
        if (mode === "signup" && rateLimited) {
          setSignupCooldown(60);
          setMessage("Too many confirmation email requests. Wait for the timer before trying again. Check your inbox and spam folder for an earlier email.");
        } else {
          setMessage(mode === "signup" ? `We couldn't complete signup: ${detail}. If this is an email delivery issue, wait before retrying.` : detail);
        }
      } else if (mode === "signup" && !result.data.session) {
        setSignupCooldown(60);
        setMessage("Signup request accepted. Check your inbox and spam folder. Wait for the timer before requesting another confirmation email.");
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
        <p className="auth-copy">{mode === "signin" ? "Sign in with your password or use a secure email link." : "Create your account to set up your workspace."}</p>
        <form className="auth-form" onSubmit={submit}>
          <label htmlFor="email">Email address</label>
          <input id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
          <label htmlFor="password">Password</label>
          <div className="password-field">
            <input id="password" type={showPassword ? "text" : "password"} autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={8} required value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" />
            <button className="password-toggle" type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>{showPassword ? "Hide" : "Show"}</button>
          </div>
          {message && <p className="auth-message" role="status" aria-live="polite">{message}</p>}
          <button className="auth-submit" type="submit" disabled={busy || (mode === "signup" && signupCooldown > 0)}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in with password" : signupCooldown > 0 ? `Try again in ${signupCooldown}s` : "Create account"}
          </button>
        </form>
        {mode === "signin" && (
          <button className="auth-secondary" type="button" onClick={sendSignInLink} disabled={linkBusy || linkCooldown > 0}>
            {linkBusy ? "Sending secure link…" : linkCooldown > 0 ? `Send another link in ${linkCooldown}s` : "Email me a sign-in link"}
          </button>
        )}
        <p className="auth-switch">{mode === "signin" ? "New to Aahana?" : "Already have an account?"} <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); setShowPassword(false); setSignupCooldown(0); }}>{mode === "signin" ? "Create account" : "Sign in"}</button></p>
        <p className="auth-legal">Your account and workspace are protected by Supabase authentication. Sign-in links are one-time use and only work for existing accounts.</p>
      </section>
    </main>
  );
}

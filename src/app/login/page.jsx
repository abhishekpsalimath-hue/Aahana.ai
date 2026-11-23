"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState("signin");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [signupCooldown, setSignupCooldown] = useState(0);
  const [canResendConfirmation, setCanResendConfirmation] = useState(false);
  const [resending, setResending] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "auth_callback") {
      setMessage("That confirmation or reset link may have expired or already been used. Request a fresh email link and try again.");
    }
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = setTimeout(() => setResendCooldown(seconds => Math.max(0, seconds - 1)), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

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
    setCanResendConfirmation(false);
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
          setMessage("A confirmation email was requested recently. Please wait before trying again, and check your inbox first.");
        } else if (mode === "signin") {
          const text = (result.error.message || "").toLowerCase();
          if (rateLimited) {
            setMessage("Too many sign-in attempts. Please wait a moment before trying again.");
          } else if (text.includes("invalid login credentials")) {
            setMessage("Email or password is incorrect. Check both and try again.");
          } else if (text.includes("email not confirmed")) {
            setMessage("Your email still needs confirmation. You can request a fresh link below.");
            setCanResendConfirmation(true);
          } else {
            setMessage("We couldn't sign you in. Please try again. If the problem continues, contact support.");
          }
        } else {
          setMessage(result.error.message || "We couldn't create your account. Please try again.");
        }
      } else if (mode === "signup" && !result.data.session) {
        setSignupCooldown(60);
        setMessage("Your signup request was received. Check your inbox and spam folder for the confirmation email.");
        setCanResendConfirmation(true);
        setResendCooldown(60);
      } else if (mode === "signin") {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session) {
          setMessage("Your sign-in was accepted, but this browser couldn't confirm the session. Please try again.");
        } else {
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

  async function resendConfirmation() {
    if (resending || resendCooldown > 0 || !email.trim()) return;
    setResending(true);
    setMessage("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        if (error.status === 429 || error.code === "over_email_send_rate_limit") {
          setResendCooldown(60);
          setMessage("Please wait 60 seconds before requesting another email. Check your inbox and spam folder first.");
        } else {
          setMessage("We couldn't send a new link right now. Please try again in a moment.");
        }
      } else {
        setResendCooldown(60);
        setMessage("If this address has a pending confirmation, a fresh link is on its way. Check your inbox and spam folder.");
        setCanResendConfirmation(false);
      }
    } catch {
      setMessage("Connection problem. Please check your internet and try again.");
    } finally {
      setResending(false);
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
          <input id="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck="false" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" />
          <label htmlFor="password">Password</label>
          {mode === "signin" && <div className="auth-inline-link"><Link href="/forgot-password">Forgot password?</Link></div>}
          <div className="password-field">
            <input id="password" type={showPassword ? "text" : "password"} autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={mode === "signup" ? 8 : undefined} required value={password} onChange={event => setPassword(event.target.value)} placeholder={mode === "signup" ? "At least 8 characters" : "Enter your password"} />
            <button className="password-toggle" type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>{showPassword ? "Hide" : "Show"}</button>
          </div>
          {mode === "signup" && <p className="auth-copy">Use at least 8 characters for your password.</p>}
          {message && <p className="auth-message" role="status" aria-live="polite">{message}</p>}
          {canResendConfirmation && <button className="auth-text-action" type="button" onClick={resendConfirmation} disabled={resending || resendCooldown > 0 || !email.trim()}>{resending ? "Sending link…" : resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend confirmation email"}</button>}
          <button className="auth-submit" type="submit" disabled={busy || (mode === "signup" && signupCooldown > 0)}>
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : signupCooldown > 0 ? `Try again in ${signupCooldown}s` : "Create account"}
          </button>
        </form>
        <p className="auth-switch">{mode === "signin" ? "New to Aahana?" : "Already have an account?"} <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setMessage(""); setShowPassword(false); setSignupCooldown(0); setCanResendConfirmation(false); setResendCooldown(0); }}>{mode === "signin" ? "Create account" : "Sign in"}</button></p>
        <p className="auth-legal">Your account and workspace are protected by Supabase authentication.</p>
      </section>
    </main>
  );
}

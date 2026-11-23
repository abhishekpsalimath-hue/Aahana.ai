"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const timer = setTimeout(() => setCooldown(seconds => Math.max(0, seconds - 1)), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function submit(event) {
    event.preventDefault();
    if (busy || cooldown > 0) return;
    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/auth/callback?next=%2Fupdate-password`,
      });
      if (error) {
        if (error.status === 429 || error.code === "over_email_send_rate_limit") {
          setCooldown(60);
          setMessage("Please wait 60 seconds before requesting another reset email.");
        } else {
          setMessage("We could not send a reset link right now. Please check the email address and try again.");
        }
      } else {
        setSent(true);
        setMessage("If an account exists for this email, a password reset link is on its way. Check your inbox and spam folder.");
      }
    } catch {
      setMessage("Connection problem. Check your internet connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link className="brand auth-brand" href="/"><span className="brand-word">Aahana</span><span className="brand-ai">AI</span></Link>
        <div className="eyebrow"><span /> ACCOUNT RECOVERY</div>
        <h1>Reset your password.</h1>
        <p className="auth-copy">Enter the email address you used for Aahana. We'll send you a secure reset link.</p>
        <form className="auth-form" onSubmit={submit}>
          <label htmlFor="email">Email address</label>
          <input id="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck="false" required value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" />
          {message && <p className="auth-message" role="status" aria-live="polite">{message}</p>}
          <button className="auth-submit" type="submit" disabled={busy || sent || cooldown > 0}>{busy ? "Sending link…" : sent ? "Reset link requested" : cooldown > 0 ? `Try again in ${cooldown}s` : "Send reset link"}</button>
        </form>
        <p className="auth-switch"><Link href="/login">Back to sign in</Link></p>
        <p className="auth-legal">Your account and workspace remain protected.</p>
      </section>
    </main>
  );
}

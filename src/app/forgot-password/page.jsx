"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/auth/callback?next=%2Fupdate-password`,
      });
      if (error) {
        setMessage("We couldn't send a reset link right now. Please check the email address and try again.");
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
          <button className="auth-submit" type="submit" disabled={busy || sent}>{busy ? "Sending link…" : sent ? "Reset link requested" : "Send reset link"}</button>
        </form>
        <p className="auth-switch"><Link href="/login">Back to sign in</Link></p>
        <p className="auth-legal">Your account and workspace remain protected.</p>
      </section>
    </main>
  );
}

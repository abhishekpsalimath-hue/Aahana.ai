"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    if (password.length < 8) {
      setMessage("Choose a password with at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setMessage("The passwords do not match. Please check and try again.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session) {
        setMessage("This reset link may have expired or already been used. Request a new one to continue.");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setMessage("We couldn't update your password. Request a new reset link and try again.");
        return;
      }
      window.location.assign("/");
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
        <h1>Choose a new password.</h1>
        <p className="auth-copy">Use at least 8 characters. Your existing workspace and conversations will stay as they are.</p>
        <form className="auth-form" onSubmit={submit}>
          <label htmlFor="password">New password</label>
          <input id="password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters" />
          <label htmlFor="confirm-password">Confirm new password</label>
          <input id="confirm-password" type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={event => setConfirmPassword(event.target.value)} placeholder="Enter it again" />
          {message && <p className="auth-message" role="status" aria-live="polite">{message}</p>}
          <button className="auth-submit" type="submit" disabled={busy}>{busy ? "Updating…" : "Update password"}</button>
        </form>
        <p className="auth-switch"><Link href="/login">Back to sign in</Link></p>
      </section>
    </main>
  );
}

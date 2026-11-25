"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mode, setMode] = useState("signin");
  const [authMethod, setAuthMethod] = useState("otp");
  const [step, setStep] = useState("credentials");
  const [otpPurpose, setOtpPurpose] = useState("signin");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [otpCooldown, setOtpCooldown] = useState(0);

  useEffect(() => {
    if (otpCooldown <= 0) return undefined;
    const timer = setTimeout(() => setOtpCooldown(seconds => Math.max(0, seconds - 1)), 1000);
    return () => clearTimeout(timer);
  }, [otpCooldown]);

  function explainAuthError(error, fallback) {
    const text = (error?.message || "").toLowerCase();
    if (error?.status === 429 || error?.code === "over_email_send_rate_limit") {
      setOtpCooldown(60);
      return "Too many code requests. Please wait a minute before trying again.";
    }
    if (text.includes("email not confirmed")) {
      return "This account still needs email verification. Switch to Create account and request a fresh verification code, or contact support if you need help recovering the account.";
    }
    if (text.includes("invalid login credentials")) {
      return "Email or password is incorrect. Check your details and try again.";
    }
    if (text.includes("expired") || text.includes("invalid") || text.includes("token")) {
      return "That code may have expired or was entered incorrectly. Request a new code and try again.";
    }
    return error?.message || fallback;
  }

  async function submit(event) {
    event.preventDefault();
    if (busy || (step === "verify" && otp.length !== 6)) return;

    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      const normalizedEmail = email.trim().toLowerCase();

      if (step === "verify") {
        const { data: verifiedData, error } = await supabase.auth.verifyOtp({
          email: normalizedEmail,
          token: otp,
          type: otpPurpose === "signup" ? "signup" : "email",
        });

        if (error) {
          setMessage(explainAuthError(error, "We couldn't verify that code. Please try again."));
          return;
        }

        if (!verifiedData.session) {
          setMessage("Your code was accepted, but a sign-in session was not returned. Please try signing in again.");
          return;
        }
        window.location.assign("/");
        return;
      }

      if (mode === "signin" && authMethod === "otp") {
        const { error } = await supabase.auth.signInWithOtp({
          email: normalizedEmail,
          options: { shouldCreateUser: false },
        });
        if (error) {
          const errorCode = (error.code || "").toLowerCase();
          const errorText = (error.message || "").toLowerCase();
          const needsSignupConfirmation = errorCode === "email_not_confirmed" || errorText.includes("email not confirmed");
          if (needsSignupConfirmation) {
            const resend = await supabase.auth.resend({ type: "signup", email: normalizedEmail });
            if (resend.error) {
              setMessage(explainAuthError(resend.error, "This account still needs email verification. We couldn't send a new code yet; please wait and try again."));
            } else {
              setOtpPurpose("signup");
              setStep("verify");
              setOtp("");
              setOtpCooldown(60);
              setMessage("This account needs one-time email verification. We sent a 6-digit code; enter it here to finish signing in.");
            }
          } else {
            setMessage(explainAuthError(error, "We couldn't send your sign-in code. Please try again."));
          }
        } else {
          setOtpPurpose("signin");
          setStep("verify");
          setOtp("");
          setOtpCooldown(60);
          setMessage("Your 6-digit sign-in code is on its way. Check your inbox and spam folder.");
        }
        return;
      }

      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password,
        });
        if (error) {
          setMessage(explainAuthError(error, "We couldn't sign you in. Please try again."));
          return;
        }
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !sessionData.session) {
          setMessage("Your sign-in was accepted, but the session could not be confirmed in this browser. Please try again.");
        } else {
          window.location.assign("/");
        }
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: { data: { full_name: fullName.trim() } },
      });
      if (error) {
        setMessage(explainAuthError(error, "We couldn't create your account. Please try again."));
      } else if (!data.session) {
        setOtpPurpose("signup");
        setStep("verify");
        setOtp("");
        setOtpCooldown(60);
        setMessage("Your account request is ready. Enter the 6-digit code we emailed you to verify your address.");
      } else {
        window.location.assign("/");
      }
    } catch {
      setMessage("Connection problem. Check your internet connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function resendCode() {
    if (busy || otpCooldown > 0) return;
    setBusy(true);
    setMessage("");
    try {
      const supabase = createClient();
      const normalizedEmail = email.trim().toLowerCase();
      const result = otpPurpose === "signup"
        ? await supabase.auth.resend({ type: "signup", email: normalizedEmail })
        : await supabase.auth.signInWithOtp({
            email: normalizedEmail,
            options: { shouldCreateUser: false },
          });

      if (result.error) {
        setMessage(explainAuthError(result.error, "We couldn't resend the code. Please try again."));
      } else {
        setOtp("");
        setOtpCooldown(60);
        setMessage("A fresh 6-digit code has been sent. Use the newest email.");
      }
    } catch {
      setMessage("Connection problem. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const isVerifying = step === "verify";

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link className="brand auth-brand" href="/"><span className="brand-word">Aahana</span><span className="brand-ai">AI</span></Link>
        <div className="eyebrow"><span /> YOUR THINKING SPACE</div>
        <h1>{isVerifying ? "Check your inbox." : mode === "signin" ? "Welcome back." : "Start with Aahana."}</h1>
        <p className="auth-copy">
          {isVerifying
            ? `Enter the 6-digit code sent to ${email.trim()}.`
            : mode === "signin"
              ? "Sign in to return to your workspace."
              : "Create your account to set up your workspace."}
        </p>

        <form className="auth-form" onSubmit={submit}>
          {!isVerifying ? (
            <>
              {mode === "signup" && (
                <>
                  <label htmlFor="fullName">Full name</label>
                  <input id="fullName" type="text" autoComplete="name" maxLength={100} required value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Your name" />
                </>
              )}
              <label htmlFor="email">Email address</label>
              <input id="email" type="email" autoComplete="email" autoCapitalize="none" spellCheck="false" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />

              {mode === "signin" ? (
                <div className="auth-switch">
                  <button type="button" onClick={() => { setAuthMethod(authMethod === "otp" ? "password" : "otp"); setMessage(""); }}>
                    {authMethod === "otp" ? "Use password instead" : "Sign in with email code"}
                  </button>
                </div>
              ) : null}

              {(mode === "signup" || authMethod === "password") && (
                <>
                  <label htmlFor="password">Password</label>
                  <div className="password-field">
                    <input id="password" type={showPassword ? "text" : "password"} autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={mode === "signup" ? 8 : undefined} required value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === "signup" ? "At least 8 characters" : "Enter your password"} />
                    <button className="password-toggle" type="button" onClick={() => setShowPassword(value => !value)} aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword}>{showPassword ? "Hide" : "Show"}</button>
                  </div>
                  {mode === "signup" && <p className="auth-copy">Use at least 8 characters for your password.</p>}
                </>
              )}
            </>
          ) : (
            <>
              <label htmlFor="otp">6-digit verification code</label>
              <input
                id="otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                required
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                aria-describedby="otp-help"
              />
              <p className="auth-copy" id="otp-help">For your security, only the newest code can be used.</p>
              <div className="auth-switch">
                <button type="button" onClick={resendCode} disabled={busy || otpCooldown > 0}>
                  {otpCooldown > 0 ? `Resend code in ${otpCooldown}s` : "Resend code"}
                </button>
                <button type="button" onClick={() => { setStep("credentials"); setOtp(""); setMessage(""); }}>
                  Change email
                </button>
              </div>
            </>
          )}

          {message && <p className="auth-message" role="status" aria-live="polite">{message}</p>}
          <button className="auth-submit" type="submit" disabled={busy || (isVerifying && otp.length !== 6)}>
            {busy
              ? "Please wait…"
              : isVerifying
                ? "Verify code"
                : mode === "signin"
                  ? authMethod === "otp" ? "Send sign-in code" : "Sign in"
                  : "Create account"}
          </button>
        </form>

        {!isVerifying && (
          <p className="auth-switch">
            {mode === "signin" ? "New to Aahana?" : "Already have an account?"}{" "}
            <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setAuthMethod("otp"); setOtpPurpose("signin"); setStep("credentials"); setMessage(""); setOtp(""); setPassword(""); setFullName(""); setShowPassword(false); }}>
              {mode === "signin" ? "Create account" : "Sign in"}
            </button>
          </p>
        )}
        <p className="auth-legal">Your account and workspace are protected by Supabase authentication.</p>
      </section>
    </main>
  );
}

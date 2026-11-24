"use client";
import { useEffect, useState } from "react";

const panel = { marginTop: 18, padding: 18, border: "1px solid #514365", borderRadius: 18, background: "#171323", color: "#f4efff" };
const button = { border: "1px solid #766292", borderRadius: 999, padding: "9px 14px", background: "#302544", color: "#f5edff", cursor: "pointer", fontWeight: 600 };
const muted = { color: "#b9adc9", fontSize: 13, lineHeight: 1.55 };

async function send(url, body) {
  const response = await fetch(url, { method: "POST", credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "The request could not be completed.");
  return data;
}

export default function AahanaSelfBuildPanel() {
  const [status, setStatus] = useState(null);
  const [open, setOpen] = useState(false);
  const [task, setTask] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [plan, setPlan] = useState(null);
  const [approvalToken, setApprovalToken] = useState("");
  const [baseSha, setBaseSha] = useState("");
  const [proposals, setProposals] = useState([]);
  const [validation, setValidation] = useState(null);
  const [pullRequest, setPullRequest] = useState(null);
  const [finalResponse, setFinalResponse] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/build/self/status", { credentials: "same-origin", cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (active && response.ok) setStatus(data);
      }).catch(() => {});
    return () => { active = false; };
  }, []);

  async function preparePlan() {
    setBusy(true); setError(""); setPlan(null); setProposals([]); setValidation(null); setPullRequest(null); setFinalResponse("");
    try {
      const data = await send("/api/agent/self-improve", { task, phase: "plan", pathHint: null });
      setPlan(data.changePlan); setApprovalToken(data.approvalToken); setBaseSha(data.repository.baseSha); setFinalResponse(data.finalResponse || "");
    } catch (e) { setError(e.message || "Aahana could not prepare a plan."); }
    finally { setBusy(false); }
  }

  async function approveAndRun() {
    if (!plan || !approvalToken || !baseSha) return;
    setBusy(true); setError(""); setProposals([]); setValidation(null); setPullRequest(null);
    try {
      const data = await send("/api/agent/self-improve", { task, phase: "execute", pathHint: null, approvedPlan: plan, approvedBaseSha: baseSha, approvalToken });
      setProposals(Array.isArray(data.proposals) ? data.proposals : []); setFinalResponse(data.finalResponse || ""); setApprovalToken("");
    } catch (e) { setError(e.message || "Aahana could not complete the approved task."); }
    finally { setBusy(false); }
  }

  async function validateProposal() {
    if (!proposals.length || !baseSha) return;
    setBusy(true); setError(""); setValidation(null);
    try {
      const data = await send("/api/agent/self-improve/validate", { baseSha, files: proposals.map((f) => ({ path: f.path, baseVersion: f.baseVersion, content: f.updatedContent })) });
      setValidation(data);
    } catch (e) { setError(e.message || "Isolated validation could not run."); }
    finally { setBusy(false); }
  }

  async function createDraftPullRequest() {
    if (!proposals.length || !baseSha || !validation?.ok) return;
    setBusy(true); setError(""); setPullRequest(null);
    try {
      const data = await send("/api/build/self/pull-request", {
        baseSha, title: plan?.title || "Aahana self-build improvement",
        summary: [plan?.problem || "A focused Aahana self-improvement.", plan?.approach || "", "Acceptance checks: " + (plan?.acceptanceChecks || []).join("; "), "Isolated validation passed."].filter(Boolean).join("\n\n"),
        files: proposals.map((f) => ({ path: f.path, content: f.updatedContent })),
        validationToken: validation?.validationToken,
      });
      setPullRequest(data.pullRequest);
    } catch (e) { setError(e.message || "A draft pull request could not be created."); }
    finally { setBusy(false); }
  }

  if (!status?.ownerAllowed) return null;
  return (
    <section style={panel} aria-label="Aahana Self-Build">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 11, letterSpacing: ".16em", color: "#c6afea", fontWeight: 700 }}>OWNER WORKSPACE</div>
          <strong style={{ display: "block", marginTop: 5, fontSize: 17 }}>Work on Aahana</strong>
          <p style={{ ...muted, margin: "4px 0 0" }}>Aahana plans first, waits for your approval, then prepares source changes for review.</p>
        </div>
        <button type="button" style={button} onClick={() => setOpen((v) => !v)}>{open ? "Close" : "Open self-build"}</button>
      </div>
      {open && <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
        {!status.agentReady && <p role="status" style={muted}>The existing Groq AI connection is not ready in this environment. No task has been sent.</p>}
        <label style={{ display: "grid", gap: 7, fontSize: 13, fontWeight: 600 }}>Development task
          <textarea value={task} onChange={(e) => setTask(e.target.value)} maxLength={3000} rows={3} placeholder="Example: Improve the Experience Lab code editor and add tests. Do not change authentication, Student Mode or production data."
            style={{ width: "100%", boxSizing: "border-box", resize: "vertical", borderRadius: 12, padding: 12, color: "#f5efff", background: "#100d18", border: "1px solid #514365" }} />
        </label>
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          <button type="button" style={button} disabled={busy || !task.trim() || !status.agentReady} onClick={preparePlan}>{busy ? "Working…" : "Ask Aahana to plan"}</button>
          {plan && !proposals.length && <button type="button" style={button} disabled={busy} onClick={approveAndRun}>Approve plan & let Aahana work</button>}
        </div>
        {plan && <div style={{ borderTop: "1px solid #514365", paddingTop: 12 }}>
          <strong>{plan.title}</strong><p style={muted}>{plan.problem}</p><p style={muted}>{plan.approach}</p>
          <div style={muted}>Files Aahana may inspect: {plan.affectedPaths?.join(", ")}</div>
          {plan.risks?.length > 0 && <div style={muted}>Risks: {plan.risks.join("; ")}</div>}
          {plan.acceptanceChecks?.length > 0 && <div style={muted}>Checks: {plan.acceptanceChecks.join("; ")}</div>}
          <p style={{ ...muted, marginBottom: 0 }}>Planning reads no source. Your approval is required before execution.</p>
        </div>}
        {finalResponse && <p style={muted} role="status">{finalResponse}</p>}
        {proposals.map((f) => <details key={f.path} style={{ borderTop: "1px solid #514365", paddingTop: 10 }}>
          <summary style={{ cursor: "pointer", fontWeight: 600 }}>{f.path} — {f.summary}</summary>
          <label style={{ display: "grid", gap: 7, marginTop: 10, fontSize: 12, color: "#cfc2df" }}>
            Review and edit proposed source
            <textarea
              aria-label={`Proposed source for ${f.path}`}
              spellCheck={false}
              value={f.updatedContent}
              onChange={(event) => {
                const updatedContent = event.target.value;
                setProposals((current) => current.map((item) => item.path === f.path ? { ...item, updatedContent } : item));
                setValidation(null);
              }}
              rows={14}
              style={{ width: "100%", boxSizing: "border-box", resize: "vertical", borderRadius: 10, padding: 12, color: "#e8def8", background: "#0c0a12", border: "1px solid #514365", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 11, lineHeight: 1.5 }}
            />
          </label>
        </details>)}
        {proposals.length > 0 && <p style={muted}>You can edit each proposed file before validation. Any edit clears the previous validation, so the exact reviewed content must pass the sandbox again.</p>}
        {proposals.length > 0 && <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          <button type="button" style={button} disabled={busy || !status.validationEnabled} onClick={validateProposal}>Validate in isolated sandbox</button>
          <button type="button" style={button} disabled={busy || !validation?.ok} onClick={createDraftPullRequest}>Create draft PR for review</button>
        </div>}
        {status.validationEnabled ? <p style={muted}>Draft PR creation unlocks only after isolated validation passes.</p> : <p style={muted}>Isolated validation is disabled in this environment. Proposals can be reviewed, but a draft PR cannot be created yet.</p>}
        {validation && <p style={muted} role="status">{validation.ok ? "Isolated validation passed." : "Isolated validation failed: " + (validation.message || validation.stage)}</p>}
        {pullRequest && <p style={muted} role="status">Draft PR created: <a href={pullRequest.url} target="_blank" rel="noreferrer" style={{ color: "#d7c3ff" }}>#{pullRequest.number} — review changes</a></p>}
        {error && <p role="alert" style={{ color: "#ffb4bf", fontSize: 13 }}>{error}</p>}
        <p style={{ ...muted, marginBottom: 0 }}>Aahana cannot write to main, merge, deploy, or change accounts and conversations. Every proposal stays under your review.</p>
      </div>}
    </section>
  );
}

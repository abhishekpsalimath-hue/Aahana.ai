"use client";
import { useMemo, useState } from "react";
import styles from "./shield.module.css";
import { SECURITY_CONTROLS as controls, SECURITY_CONTROL_GROUPS as groups, getReviewSummary, toggleReviewedControl } from "@/lib/shield/security-controls.mjs";
import { createAssessmentRecord } from "@/lib/shield/assessment-scope.mjs";

const suggestedExpiry = new Date(Date.now() + 7 * 86400000).toISOString().slice(0,10);

export default function ShieldWorkspace(){
 const [done,setDone]=useState([]);
 const [filter,setFilter]=useState("All controls");
 const [selected,setSelected]=useState("mfa");
 const [showPlan,setShowPlan]=useState(false);
 const [authorized,setAuthorized]=useState(false);
 const [authorizationNote,setAuthorizationNote]=useState("");
 const [assets,setAssets]=useState("");
 const [expiresOn,setExpiresOn]=useState(suggestedExpiry);
 const [scopeResult,setScopeResult]=useState(null);
 const summary=useMemo(()=>getReviewSummary(done),[done]);
 const progress=summary.percentage;
 const visible=useMemo(()=>filter==="All controls"?controls:controls.filter(x=>x.group===filter),[filter]);
 const active=controls.find(x=>x.id===selected)||controls[0];
 function toggle(id){setDone(current=>toggleReviewedControl(current,id));}
 function submitScope(event){
  event.preventDefault();
  const scope={
   authorized,
   authorizationNote,
   assets:assets.split(/[\n,]+/).map(value=>value.trim()).filter(Boolean),
   expiresAt:expiresOn?new Date(expiresOn+"T23:59:59.000Z").toISOString():"",
  };
  setScopeResult(createAssessmentRecord(scope,{assessmentId:"local-scope-review"}));
 }
 return <main className={styles.page}>
  <header className={styles.top}><a className={styles.brand} href="/"><b>a</b>Aahana <i>Shield</i></a><div><span>PROTOTYPE · SAMPLE CHECKLIST</span><a href="/">Back to Aahana</a></div></header>
  <section className={styles.hero}><div><small>● SECURITY & DATA PROTECTION</small><h1>Protect what <em>matters.</em></h1><p>A practical view of security work — with ownership, evidence and recovery built in.</p></div><aside><b>CLARITY OVER FALSE CONFIDENCE</b><span>This workspace does not scan systems or verify live security settings.</span></aside></section>
  <section className={styles.overview}><div className={styles.progressCard}><div className={styles.between}><div><small>READINESS CHECKLIST</small><h2>Your control review</h2></div><span className={styles.tag}>SAMPLE DATA</span></div><div className={styles.progressLine}><div><b>{summary.reviewedCount}<small> / {summary.totalCount}</small></b><span>controls marked reviewed</span></div><strong>{progress}%</strong></div><div className={styles.track}><i style={{width:progress+"%"}} /></div><p>Progress reflects only the items you mark below. It is not a security score or scan result.</p></div><div className={styles.priority}><small>START HERE</small><h3>Close the highest-impact gaps first.</h3><p>Prioritise identity, recoverability and sensitive data before adding more tools.</p><p><b>{summary.highPriorityRemaining}</b> high-priority controls remain unreviewed.</p><button onClick={()=>{setFilter("All controls");setSelected("mfa");}}>Review priority controls ↗</button></div></section>
  <section className={styles.scope}>
   <div><small>AUTHORIZED ASSET SCOPE</small><h2>Declare what you own or may assess.</h2><p>This records an explicit, time-limited authorization statement. It does not verify ownership and does not start a scan.</p></div>
   <form onSubmit={submitScope}>
    <label className={styles.consent}><input type="checkbox" checked={authorized} onChange={event=>{setAuthorized(event.target.checked);setScopeResult(null);}} /> I own these assets or have written permission to assess them.</label>
    <label>Exact hostnames (one per line or comma-separated)<textarea value={assets} onChange={event=>{setAssets(event.target.value);setScopeResult(null);}} rows={3} placeholder={"example.com\napp.example.com"} required /></label>
    <label>Authorization note<textarea value={authorizationNote} onChange={event=>{setAuthorizationNote(event.target.value);setScopeResult(null);}} rows={2} maxLength={1000} placeholder="Describe your ownership or written authorization..." required /></label>
    <label>Authorization expires on<input type="date" value={expiresOn} min={new Date().toISOString().slice(0,10)} onChange={event=>{setExpiresOn(event.target.value);setScopeResult(null);}} required /></label>
    <button type="submit">Validate authorization scope ↗</button>
   </form>
   {scopeResult&&<div className={scopeResult.ok?styles.scopeSuccess:styles.scopeError}><b>{scopeResult.ok?"SCOPE FORMAT ACCEPTED":"SCOPE NOT ACCEPTED"}</b><p>{scopeResult.ok?"The declared hostnames and expiry passed local validation. No network activity occurred and no security finding was produced.":scopeResult.errors?.join(" ")}</p></div>}
   <small className={styles.local}>Local validation only · Your attestation is not independent proof of ownership · No network activity</small>
  </section>
  <section className={styles.controls}><div className={styles.between}><div><small>SECURITY BASELINE</small><h2>Control checklist</h2></div><span className={styles.count}>{summary.reviewedCount} REVIEWED</span></div><div className={styles.filters}>{groups.map(g=><button key={g} className={filter===g?styles.filterOn:styles.filter} onClick={()=>{setFilter(g);const first=controls.find(x=>g==="All controls"||x.group===g);if(first)setSelected(first.id);}}>{g}</button>)}</div><div className={styles.layout}><div className={styles.list}>{visible.map(x=><button key={x.id} className={selected===x.id?styles.itemOn:styles.item} onClick={()=>setSelected(x.id)}><span className={done.includes(x.id)?styles.checked:styles.check}>{done.includes(x.id)?"✓":""}</span><span className={styles.itemText}><small>{x.group} · {x.priority} priority</small><b>{x.title}</b><em>{x.detail}</em></span><i>›</i></button>)}</div><aside className={styles.detail}><small>CONTROL DETAIL</small><label>{active.group.toUpperCase()}</label><h3>{active.title}</h3><p>{active.detail}</p><div className={styles.evidence}><b>What good evidence looks like</b><ul>{active.evidence.map(item=><li key={item}>{item}</li>)}</ul></div><button className={done.includes(active.id)?styles.doneButton:styles.markButton} onClick={()=>toggle(active.id)}>{done.includes(active.id)?"✓ Marked as reviewed":"Mark as reviewed"}</button><small className={styles.local}>Browser session only · not stored in your account</small></aside></div></section>
  <section className={styles.response}><div><small>INCIDENT READINESS</small><h2>Know the first five moves.</h2><p>A calm response starts with a prepared sequence, not guesswork.</p></div><button onClick={()=>setShowPlan(!showPlan)}>{showPlan?"Close response plan":"View response plan"} ↗</button>{showPlan&&<ol><li><b>Contain safely.</b> Limit affected access without destroying evidence.</li><li><b>Preserve evidence.</b> Record timestamps, alerts and relevant logs securely.</li><li><b>Notify the right people.</b> Follow your internal and legal escalation process.</li><li><b>Recover deliberately.</b> Restore from a known-good backup after validating the cause.</li><li><b>Learn and improve.</b> Document impact, root cause and follow-up actions.</li></ol>}</section>
  <footer className={styles.foot}><b>AAHANA SHIELD</b><span>Defensive guidance, transparent evidence, human-owned decisions.</span></footer>
 </main>;
}

"use client";
import { useMemo, useState } from "react";
import styles from "./shield.module.css";
const controls=[
{id:"mfa",group:"Identity",title:"Multi-factor authentication",detail:"Require a second factor for accounts with access to business data.",priority:"High"},
{id:"least",group:"Identity",title:"Least-privilege access",detail:"Review who can view, edit, export and administer sensitive information.",priority:"High"},
{id:"backup",group:"Resilience",title:"Tested backups",detail:"Confirm backups exist and periodically test a restore.",priority:"High"},
{id:"recovery",group:"Resilience",title:"Recovery ownership",detail:"Assign a recovery owner and document escalation contacts.",priority:"Medium"},
{id:"encrypt",group:"Data protection",title:"Encryption review",detail:"Verify encryption in transit and at rest for approved data stores.",priority:"High"},
{id:"retention",group:"Data protection",title:"Retention policy",detail:"Define how long business records are kept and how deletion is verified.",priority:"Medium"},
{id:"logs",group:"Monitoring",title:"Audit log review",detail:"Know which important events are recorded and who reviews them.",priority:"Medium"},
{id:"incident",group:"Monitoring",title:"Incident response plan",detail:"Document containment, communication, evidence and recovery steps.",priority:"Medium"}];
const groups=["All controls","Identity","Resilience","Data protection","Monitoring"];
export default function ShieldWorkspace(){
 const [done,setDone]=useState([]);
 const [filter,setFilter]=useState("All controls");
 const [selected,setSelected]=useState("mfa");
 const [showPlan,setShowPlan]=useState(false);
 const progress=Math.round(done.length/controls.length*100);
 const visible=useMemo(()=>filter==="All controls"?controls:controls.filter(x=>x.group===filter),[filter]);
 const active=controls.find(x=>x.id===selected)||controls[0];
 function toggle(id){setDone(current=>current.includes(id)?current.filter(x=>x!==id):[...current,id]);}
 return <main className={styles.page}>
  <header className={styles.top}><a className={styles.brand} href="/"><b>a</b>Aahana <i>Shield</i></a><div><span>PROTOTYPE · SAMPLE CHECKLIST</span><a href="/">Back to Aahana</a></div></header>
  <section className={styles.hero}><div><small>● SECURITY & DATA PROTECTION</small><h1>Protect what <em>matters.</em></h1><p>A practical view of security work — with ownership, evidence and recovery built in.</p></div><aside><b>CLARITY OVER FALSE CONFIDENCE</b><span>This workspace does not scan systems or verify live security settings.</span></aside></section>
  <section className={styles.overview}><div className={styles.progressCard}><div className={styles.between}><div><small>READINESS CHECKLIST</small><h2>Your control review</h2></div><span className={styles.tag}>SAMPLE DATA</span></div><div className={styles.progressLine}><div><b>{done.length}<small> / {controls.length}</small></b><span>controls marked reviewed</span></div><strong>{progress}%</strong></div><div className={styles.track}><i style={{width:progress+"%"}} /></div><p>Progress reflects only the items you mark below. It is not a security score or scan result.</p></div><div className={styles.priority}><small>START HERE</small><h3>Close the highest-impact gaps first.</h3><p>Prioritise identity, recoverability and sensitive data before adding more tools.</p><button onClick={()=>{setFilter("All controls");setSelected("mfa");}}>Review priority controls ↗</button></div></section>
  <section className={styles.controls}><div className={styles.between}><div><small>SECURITY BASELINE</small><h2>Control checklist</h2></div><span className={styles.count}>{done.length} REVIEWED</span></div><div className={styles.filters}>{groups.map(g=><button key={g} className={filter===g?styles.filterOn:styles.filter} onClick={()=>setFilter(g)}>{g}</button>)}</div><div className={styles.layout}><div className={styles.list}>{visible.map(x=><button key={x.id} className={selected===x.id?styles.itemOn:styles.item} onClick={()=>setSelected(x.id)}><span className={done.includes(x.id)?styles.checked:styles.check}>{done.includes(x.id)?"✓":""}</span><span className={styles.itemText}><small>{x.group} · {x.priority} priority</small><b>{x.title}</b><em>{x.detail}</em></span><i>›</i></button>)}</div><aside className={styles.detail}><small>CONTROL DETAIL</small><label>{active.group.toUpperCase()}</label><h3>{active.title}</h3><p>{active.detail}</p><div className={styles.evidence}><b>What good evidence looks like</b><ul><li>A named owner responsible for this control.</li><li>A documented setting, procedure or review record.</li><li>A date for the next verification.</li></ul></div><button className={done.includes(active.id)?styles.doneButton:styles.markButton} onClick={()=>toggle(active.id)}>{done.includes(active.id)?"✓ Marked as reviewed":"Mark as reviewed"}</button><small className={styles.local}>Browser session only · not stored in your account</small></aside></div></section>
  <section className={styles.response}><div><small>INCIDENT READINESS</small><h2>Know the first five moves.</h2><p>A calm response starts with a prepared sequence, not guesswork.</p></div><button onClick={()=>setShowPlan(!showPlan)}>{showPlan?"Close response plan":"View response plan"} ↗</button>{showPlan&&<ol><li><b>Contain safely.</b> Limit affected access without destroying evidence.</li><li><b>Preserve evidence.</b> Record timestamps, alerts and relevant logs securely.</li><li><b>Notify the right people.</b> Follow your internal and legal escalation process.</li><li><b>Recover deliberately.</b> Restore from a known-good backup after validating the cause.</li><li><b>Learn and improve.</b> Document impact, root cause and follow-up actions.</li></ol>}</section>
  <footer className={styles.foot}><b>AAHANA SHIELD</b><span>Defensive guidance, transparent evidence, human-owned decisions.</span></footer>
 </main>;
}

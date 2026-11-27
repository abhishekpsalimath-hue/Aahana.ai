"use client";
import { useMemo, useState } from "react";
import styles from "./flow.module.css";
const templates = [
 {id:"enquiries",name:"New enquiry follow-up",category:"Sales",detail:"Capture an enquiry, assign an owner and prepare a response.",steps:["New enquiry received","Assign to sales owner","Prepare follow-up draft","Approval before sending"]},
 {id:"invoice",name:"Invoice review",category:"Finance ops",detail:"Extract invoice details and route exceptions for review.",steps:["Invoice added","Extract supplier and totals","Check required fields","Human review and approval"]},
 {id:"daily",name:"Daily business summary",category:"Operations",detail:"Prepare a daily snapshot from connected business data.",steps:["Weekday schedule","Collect approved source data","Prepare summary","Send report after approval"]}
];
export default function FlowWorkspace(){
 const [activeId,setActiveId]=useState("enquiries");
 const [prompt,setPrompt]=useState("");
 const [draft,setDraft]=useState("");
 const [ran,setRan]=useState(false);
 const [logs,setLogs]=useState(false);
 const active=templates.find(x=>x.id===activeId)||templates[0];
 const completed=useMemo(()=>ran?active.steps.length:0,[ran,active.steps.length]);
 function makeDraft(e){e.preventDefault();if(prompt.trim()){setDraft(prompt.trim());setRan(false);setLogs(false);}}
 return <main className={styles.page}>
  <header className={styles.top}><a className={styles.brand} href="/"><b>a</b>Aahana <i>Flow</i></a><div><span>PROTOTYPE · DEMO DATA</span><a href="/">Back to Aahana</a></div></header>
  <section className={styles.hero}><div><small>● BUSINESS AUTOMATION</small><h1>Make work <em>flow.</em></h1><p>Describe the outcome. Shape the workflow. Keep people in control of every important action.</p></div><aside><b>Human-led automation</b><span>Approvals built into the flow</span></aside></section>
  <section className={styles.prompt}><small>START WITH AN OUTCOME</small><h2>What would you like to automate?</h2><form onSubmit={makeDraft}><label className={styles.sr} htmlFor="flow-prompt">Describe a workflow</label><input id="flow-prompt" value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Every morning, prepare a sales summary and ask me to approve it..." /><button disabled={!prompt.trim()}>Create preview ↗</button></form><p>This prototype creates a local preview only. It does not connect to apps or send messages.</p>{draft&&<div className={styles.draft}><b>PREVIEW REQUEST</b><p>{draft}</p><small>Connect approved triggers and data sources before real execution.</small></div>}</section>
  <div className={styles.section}><div><small>WORKFLOW STARTERS</small><h2>Start with a proven pattern</h2></div><span>03 TEMPLATES</span></div>
  <section className={styles.cards}>{templates.map(t=><button key={t.id} className={activeId===t.id?styles.cardOn:styles.card} onClick={()=>{setActiveId(t.id);setRan(false);setLogs(false);}}><small>{t.category}</small><b>{t.name}</b><p>{t.detail}</p><span>Open workflow →</span></button>)}</section>
  <section className={styles.builder}><header><div><small>VISUAL WORKFLOW</small><h2>{active.name}</h2><p>{active.detail}</p></div><button onClick={()=>{setRan(true);setLogs(true);}}>Run dry run ▶</button></header><div className={styles.canvas}><small>FLOW CANVAS · {active.steps.length} STEPS</small><div className={styles.nodes}>{active.steps.map((step,i)=><div className={styles.nodeWrap} key={active.id+"-"+step}><article className={ran?styles.nodeDone:styles.node}><span>{["◉","↗","✳","✓"][i]}</span><div><small>STEP {String(i+1).padStart(2,"0")} · {i===0?"TRIGGER":i===active.steps.length-1?"APPROVAL":"ACTION"}</small><b>{step}</b></div><i>{ran?"✓":"•••"}</i></article>{i<active.steps.length-1&&<div className={styles.connector}>↓</div>}</div>)}</div><footer><span>● {ran?completed+" demo steps passed":"Paused until approved services are connected"}</span><button onClick={()=>setLogs(!logs)}>{logs?"Hide run details":"View run details"} ↗</button></footer>{logs&&<div className={styles.logs}><b>Dry-run result</b><p>All {active.steps.length} preview steps completed using sample data. No external requests, record changes or messages.</p><small>Client-side simulation · External side effects: none</small></div>}</div></section>
  <footer className={styles.foot}><b>AAHANA FLOW</b><span>Think less about repetitive work. Keep control of what matters.</span></footer>
 </main>;
}

"use client";
import { useState } from "react";
import styles from "./flow.module.css";
import { createDryRunPlan } from "@/lib/flow/workflow-model.mjs";
import { suggestWorkflowTemplate } from "@/lib/flow/workflow-planner.mjs";
import { createWorkflowDraft } from "@/lib/flow/workflow-draft.mjs";

const templates = [
 {id:"enquiries",name:"New enquiry follow-up",category:"Sales",detail:"Capture an enquiry, assign an owner and prepare a response.",steps:["New enquiry received","Assign to sales owner","Prepare follow-up draft","Approval before sending"],operations:["assign_owner","prepare_draft"]},
 {id:"invoice",name:"Invoice review",category:"Finance ops",detail:"Extract invoice details and route exceptions for review.",steps:["Invoice added","Extract supplier and totals","Check required fields","Human review and approval"],operations:["validate_fields","collect_sample_data"]},
 {id:"daily",name:"Daily business summary",category:"Operations",detail:"Prepare a daily snapshot from connected business data.",steps:["Weekday schedule","Collect approved source data","Prepare summary","Send report after approval"],operations:["collect_sample_data","prepare_summary"]}
];
const toWorkflowSteps = (template) => template.steps.map((label,index) =>
 index===0?{id:"trigger",type:"trigger",label}:
 index===template.steps.length-1?{id:"approval",type:"approval",label}:
 {id:"action-"+index,type:"action",operation:template.operations[index-1],label}
);

export default function FlowWorkspace(){
 const [activeId,setActiveId]=useState("enquiries");
 const [workflowSteps,setWorkflowSteps]=useState(()=>toWorkflowSteps(templates[0]));
 const [newStepLabel,setNewStepLabel]=useState("");
 const [newOperation,setNewOperation]=useState("prepare_summary");
 const [nextStepId,setNextStepId]=useState(1);
 const [prompt,setPrompt]=useState("");
 const [draft,setDraft]=useState(null);
 const [dryRun,setDryRun]=useState(null);
 const [logs,setLogs]=useState(false);
 const active=templates.find(x=>x.id===activeId)||templates[0];
 const completed=dryRun?.steps?.filter(step=>step.status==="simulated").length||0;
 const suggestion=suggestWorkflowTemplate(prompt);
 function makeDraft(e){
  e.preventDefault();
  const result=createWorkflowDraft(prompt);
  setDraft(result);
  setDryRun(null);
  setLogs(false);
  if(result.ok){
   setActiveId(result.workflow.id);
   setWorkflowSteps(result.workflow.steps);
  }
 }
 function loadTemplate(id){
  const chosen=templates.find(t=>t.id===id);
  if(!chosen)return;
  setActiveId(chosen.id);
  setWorkflowSteps(toWorkflowSteps(chosen));
  setDryRun(null);
  setLogs(false);
 }
 function addAction(e){
  e.preventDefault();
  const label=newStepLabel.trim();
  if(!label||workflowSteps.length>=30)return;
  const action={id:"custom-"+nextStepId,type:"action",operation:newOperation,label};
  setWorkflowSteps(current=>[...current.slice(0,-1),action,current[current.length-1]]);
  setNextStepId(value=>value+1);
  setNewStepLabel("");
  setDryRun(null);
  setLogs(false);
 }
 function removeAction(id){
  setWorkflowSteps(current=>current.filter(step=>step.id!==id));
  setDryRun(null);
  setLogs(false);
 }
 return <main className={styles.page}>
  <header className={styles.top}><a className={styles.brand} href="/"><b>a</b>Aahana <i>Flow</i></a><div><span>PROTOTYPE · DEMO DATA</span><a href="/">Back to Aahana</a></div></header>
  <section className={styles.hero}><div><small>● BUSINESS AUTOMATION</small><h1>Make work <em>flow.</em></h1><p>Describe the outcome. Shape the workflow. Keep people in control of every important action.</p></div><aside><b>Human-led automation</b><span>Approvals built into the flow</span></aside></section>
  <section className={styles.prompt}>
   <small>START WITH AN OUTCOME</small><h2>What would you like to automate?</h2>
   <form onSubmit={makeDraft}><label className={styles.sr} htmlFor="flow-prompt">Describe a workflow</label><input id="flow-prompt" value={prompt} onChange={e=>setPrompt(e.target.value)} maxLength={500} placeholder="Every morning, prepare a sales summary and ask me to approve it..." /><button disabled={!prompt.trim()}>Create structured draft ↗</button></form>
   <p>This prototype uses transparent keyword matching and fixed safe starters—not an AI model. It creates a local draft only; it does not connect to apps, schedule jobs or send messages.</p>
   {prompt.trim()&&<div className={styles.draft}><b>STARTER SUGGESTION · KEYWORD MATCH ONLY</b>{suggestion.matched?<><p>{templates.find(t=>t.id===suggestion.templateId)?.name} — {suggestion.reason}</p><small>Confidence: {suggestion.confidence}. Review the complete steps before using a future integration.</small><button type="button" onClick={()=>loadTemplate(suggestion.templateId)}>Load suggested starter ↗</button></>:<p>{suggestion.reason}</p>}</div>}
   {draft&&<div className={styles.draft} role="status" aria-live="polite" aria-atomic="true"><b>{draft.ok?"STRUCTURED WORKFLOW DRAFT":"NO WORKFLOW GENERATED"}</b><p>{draft.ok?draft.workflow.name+": "+draft.requestSummary:draft.reason}</p>{draft.ok?<><small>Validated · {draft.workflow.steps.length} steps · {draft.confidence} confidence · no external side effects</small><ol>{draft.explanations.map(step=><li key={step.stepId}><b>{step.sequence}. {step.label}</b><br />{step.explanation}</li>)}</ol></>:<small>Choose a starter manually or describe a clearer outcome. Nothing was guessed or executed.</small>}</div>}
  </section>
  <div className={styles.section}><div><small>WORKFLOW STARTERS</small><h2>Start with a proven pattern</h2></div><span>03 TEMPLATES</span></div>
  <section className={styles.cards}>{templates.map(t=><button key={t.id} className={activeId===t.id?styles.cardOn:styles.card} aria-pressed={activeId===t.id} onClick={()=>loadTemplate(t.id)}><small>{t.category}</small><b>{t.name}</b><p>{t.detail}</p><span>Open workflow →</span></button>)}</section>
  <section className={styles.builder}><header><div><small>VISUAL WORKFLOW</small><h2>{active.name}</h2><p>{active.detail}</p></div><button onClick={()=>{setDryRun(createDryRunPlan({id:active.id,name:active.name,steps:workflowSteps}));setLogs(true);}}>Run dry run ▶</button></header>
   <div className={styles.canvas}><small>FLOW CANVAS · {workflowSteps.length} STEPS</small>
    <form className={styles.addStep} onSubmit={addAction}><input aria-label="New workflow action" value={newStepLabel} onChange={e=>setNewStepLabel(e.target.value)} maxLength={160} placeholder="Add an action to this workflow..." /><select aria-label="Action type" value={newOperation} onChange={e=>setNewOperation(e.target.value)}><option value="prepare_summary">Prepare summary</option><option value="validate_fields">Validate fields</option><option value="collect_sample_data">Collect sample data</option><option value="assign_owner">Assign owner</option><option value="prepare_draft">Prepare draft (approval required)</option><option value="notify_owner">Notify owner (approval required)</option></select><button disabled={!newStepLabel.trim()||workflowSteps.length>=30}>+ Add step</button></form>
    <div className={styles.nodes}>{workflowSteps.map((step,i)=><div className={styles.nodeWrap} key={step.id}><article className={dryRun?.steps?.[i]?.status==="simulated"?styles.nodeDone:styles.node}><span>{step.type==="trigger"?"◉":step.type==="approval"?"✓":"↗"}</span><div><small>STEP {String(i+1).padStart(2,"0")} · {step.type.toUpperCase()}</small><b>{step.label}</b></div><i>{dryRun?.steps?.[i]?.status==="simulated"?"✓":dryRun?.steps?.[i]?.status==="awaiting-human-approval"?"!":"•••"}</i>{step.type==="action"&&<button className={styles.removeStep} type="button" aria-label={"Remove "+step.label} onClick={()=>removeAction(step.id)}>×</button>}</article>{i<workflowSteps.length-1&&<div className={styles.connector}>↓</div>}</div>)}</div>
    <footer><span role="status" aria-live="polite" aria-atomic="true">● {dryRun?.ok?completed+" steps simulated · approval pending":dryRun?"Dry run blocked · fix workflow definition":"Ready for a safe dry run"}</span><button onClick={()=>setLogs(!logs)}>{logs?"Hide run details":"View run details"} ↗</button></footer>
    {logs&&<div className={styles.logs}><b>Dry-run result</b>{dryRun?.ok?<><p>{dryRun.steps.length-1} steps simulated. The final human approval remains pending; nothing was sent or changed.</p><ul>{dryRun.steps.map(step=><li key={step.stepId}>{step.sequence}. {step.label} — {step.status}</li>)}</ul></>:<><p>The workflow did not pass its safety checks.</p><ul>{(dryRun?.errors||["Run the validation again."]).map(error=><li key={error}>{error}</li>)}</ul></>}<small>Validated locally · External side effects: none</small></div>}
   </div>
  </section>
  <footer className={styles.foot}><b>AAHANA FLOW</b><span>Think less about repetitive work. Keep control of what matters.</span></footer>
 </main>;
}

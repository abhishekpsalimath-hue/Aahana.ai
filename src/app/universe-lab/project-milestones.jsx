"use client";

import { useMemo, useState } from "react";
import styles from "./universe-lab.module.css";

const DEFAULT_MILESTONES = [
  { id: "scope", title: "Confirm project scope", dueDate: "", status: "planned" },
  { id: "evidence", title: "Gather and assess evidence", dueDate: "", status: "planned" },
  { id: "draft", title: "Complete first draft", dueDate: "", status: "planned" },
  { id: "review", title: "Review and refine", dueDate: "", status: "planned" },
  { id: "deliver", title: "Prepare final deliverable", dueDate: "", status: "planned" },
];

export default function ProjectMilestones() {
  const [milestones, setMilestones] = useState(DEFAULT_MILESTONES);
  const [newTitle, setNewTitle] = useState("");
  const completed = useMemo(() => milestones.filter((item) => item.status === "done").length, [milestones]);
  const update = (id, patch) => setMilestones((current) => current.map((item) => item.id === id ? { ...item, ...patch } : item));
  return <section className={styles.projectMilestonePanel} aria-label="Project milestones">
    <div className={styles.projectMilestoneHeading}>
      <div><span className={styles.blueprintLabel}>PROJECT DELIVERY</span><h5>Milestones & deliverables</h5><p>{completed} of {milestones.length} milestones complete</p></div>
    </div>
    <div className={styles.projectMilestoneList}>
      {milestones.map((milestone, index) => <article className={styles.projectMilestone} key={milestone.id}>
        <span className={styles.projectMilestoneNumber}>{String(index + 1).padStart(2, "0")}</span>
        <label>Milestone<input value={milestone.title} maxLength={100} onChange={(event) => update(milestone.id, { title: event.target.value })} /></label>
        <label>Target date<input type="date" value={milestone.dueDate} onChange={(event) => update(milestone.id, { dueDate: event.target.value })} /></label>
        <label>Status<select value={milestone.status} onChange={(event) => update(milestone.id, { status: event.target.value })}><option value="planned">Planned</option><option value="in-progress">In progress</option><option value="done">Complete</option></select></label>
        <button type="button" onClick={() => setMilestones((current) => current.filter((item) => item.id !== milestone.id))} aria-label={"Remove milestone " + milestone.title}>Remove</button>
      </article>)}
    </div>
    <div className={styles.projectAddMilestone}>
      <input value={newTitle} maxLength={100} onChange={(event) => setNewTitle(event.target.value)} placeholder="Add a deliverable or milestone" aria-label="New milestone title" />
      <button type="button" disabled={!newTitle.trim() || milestones.length >= 30} onClick={() => { setMilestones((current) => [...current, { id: "custom-" + Date.now(), title: newTitle.trim(), dueDate: "", status: "planned" }]); setNewTitle(""); }}>Add milestone +</button>
    </div>
    <p className={styles.gravityCaution}>Milestones are temporary planning data in this browser session. They are not persisted or included in the chapter JSON export yet.</p>
  </section>;
}

export const SECURITY_CONTROLS = Object.freeze([
  {id:"mfa",group:"Identity",title:"Multi-factor authentication",detail:"Require a second factor for accounts with access to business data.",evidence:["Identity-provider policy showing MFA enforcement.","Documented, time-bound exceptions with an owner.","A tested sign-in showing the challenge is enforced."],priority:"High"},
  {id:"least",group:"Identity",title:"Least-privilege access",detail:"Review who can view, edit, export and administer sensitive information.",evidence:["Current role-to-permission matrix.","Named owners for privileged accounts.","A dated access review with remediation records."],priority:"High"},
  {id:"backup",group:"Resilience",title:"Tested backups",detail:"Confirm backups exist and periodically test a restore.",evidence:["Recent backup completion records.","Off-site or immutable backup configuration.","A restore-test result with date and owner."],priority:"High"},
  {id:"recovery",group:"Resilience",title:"Recovery ownership",detail:"Assign a recovery owner and document escalation contacts.",evidence:["Named recovery lead and backup owner.","Current escalation contact list.","Approved recovery time and recovery point objectives."],priority:"Medium"},
  {id:"encrypt",group:"Data protection",title:"Encryption review",detail:"Verify encryption in transit and at rest for approved data stores.",evidence:["TLS configuration for exposed services.","Storage/database encryption configuration.","Key ownership and rotation procedure."],priority:"High"},
  {id:"retention",group:"Data protection",title:"Retention policy",detail:"Define how long business records are kept and how deletion is verified.",evidence:["Approved retention schedule by data category.","Deletion workflow and completion evidence.","Documented legal-hold exceptions."],priority:"Medium"},
  {id:"logs",group:"Monitoring",title:"Audit log review",detail:"Know which important events are recorded and who reviews them.",evidence:["Inventory of critical audit-log sources.","Access controls and retention settings for logs.","Named reviewer and alert follow-up records."],priority:"Medium"},
  {id:"incident",group:"Monitoring",title:"Incident response plan",detail:"Document containment, communication, evidence and recovery steps.",evidence:["Approved incident-response runbook.","Current internal and external contact list.","A recent tabletop exercise and action log."],priority:"Medium"},
].map((control) => Object.freeze({...control,evidence:Object.freeze([...control.evidence])})));

export const SECURITY_CONTROL_GROUPS = Object.freeze([
  "All controls",
  ...new Set(SECURITY_CONTROLS.map((control) => control.group)),
]);

const CONTROL_IDS = new Set(SECURITY_CONTROLS.map((control) => control.id));

export function getReviewSummary(reviewedIds) {
  const reviewed = new Set(
    Array.isArray(reviewedIds)
      ? reviewedIds.filter((id) => typeof id === "string" && CONTROL_IDS.has(id))
      : [],
  );
  const reviewedCount = reviewed.size;
  const highPriorityRemaining = SECURITY_CONTROLS.filter(
    (control) => control.priority === "High" && !reviewed.has(control.id),
  ).length;
  return Object.freeze({
    reviewedCount,
    totalCount: SECURITY_CONTROLS.length,
    percentage: Math.round((reviewedCount / SECURITY_CONTROLS.length) * 100),
    highPriorityRemaining,
  });
}

export function toggleReviewedControl(reviewedIds, controlId) {
  const current = new Set(
    Array.isArray(reviewedIds)
      ? reviewedIds.filter((id) => typeof id === "string" && CONTROL_IDS.has(id))
      : [],
  );
  if (!CONTROL_IDS.has(controlId)) return [...current];
  if (current.has(controlId)) current.delete(controlId);
  else current.add(controlId);
  return [...current];
}

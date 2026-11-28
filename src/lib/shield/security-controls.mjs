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

export const EVIDENCE_REVIEW_STATUSES = Object.freeze([
  "not-reviewed",
  "evidence-present",
  "gap-found",
]);

const REVIEW_KEYS = new Set(["status", "note", "remediationOwner", "dueDate"]);
const CONTROL_CHARACTERS = /[\u0000-\u001f\u007f]/;

function isPlainRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  try {
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  } catch {
    return false;
  }
}

function readOwnData(record, key) {
  try {
    const descriptor = Object.getOwnPropertyDescriptor(record, key);
    return descriptor && Object.hasOwn(descriptor, "value")
      ? { present: true, value: descriptor.value }
      : { present: false, value: undefined };
  } catch {
    return { present: false, value: undefined };
  }
}

function validDateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function sanitizeExistingReviews(reviews) {
  const safe = Object.create(null);
  if (!reviews || typeof reviews !== "object" || Array.isArray(reviews)) return safe;
  for (const control of SECURITY_CONTROLS) {
    const entry = readOwnData(reviews, control.id);
    if (!entry.present || !isPlainRecord(entry.value)) continue;
    const record = entry.value;
    const keys = Object.keys(record);
    if (keys.some((key) => !REVIEW_KEYS.has(key))) continue;
    const status = readOwnData(record, "status");
    const note = readOwnData(record, "note");
    const owner = readOwnData(record, "remediationOwner");
    const dueDate = readOwnData(record, "dueDate");
    if (!status.present || !EVIDENCE_REVIEW_STATUSES.includes(status.value) ||
        !note.present || typeof note.value !== "string" || note.value.length > 500 ||
        CONTROL_CHARACTERS.test(note.value)) continue;
    const remediationOwner = owner.present ? owner.value : "";
    const targetDate = dueDate.present ? dueDate.value : "";
    if (typeof remediationOwner !== "string" || remediationOwner.length > 80 ||
        CONTROL_CHARACTERS.test(remediationOwner) ||
        (targetDate !== "" && !validDateOnly(targetDate))) continue;
    safe[control.id] = Object.freeze({
      status: status.value,
      note: note.value.trim(),
      remediationOwner: remediationOwner.trim(),
      dueDate: targetDate,
    });
  }
  return safe;
}

export function updateEvidenceReview(reviews, controlId, input) {
  if (!CONTROL_IDS.has(controlId)) {
    return { ok: false, errors: ["Choose a known security control."], reviews: null };
  }
  if (!isPlainRecord(input) || Object.keys(input).some((key) => !REVIEW_KEYS.has(key))) {
    return { ok: false, errors: ["Evidence review contains unsupported fields."], reviews: null };
  }
  const status = readOwnData(input, "status");
  const note = readOwnData(input, "note");
  const owner = readOwnData(input, "remediationOwner");
  const dueDate = readOwnData(input, "dueDate");
  if (!status.present || !EVIDENCE_REVIEW_STATUSES.includes(status.value)) {
    return { ok: false, errors: ["Choose a valid evidence review status."], reviews: null };
  }
  if (!note.present || typeof note.value !== "string" || note.value.length > 500 ||
      CONTROL_CHARACTERS.test(note.value)) {
    return { ok: false, errors: ["Evidence notes must be 500 characters or fewer and contain no control characters."], reviews: null };
  }
  const remediationOwner = owner.present ? owner.value : "";
  const targetDate = dueDate.present ? dueDate.value : "";
  if (typeof remediationOwner !== "string" || remediationOwner.length > 80 ||
      CONTROL_CHARACTERS.test(remediationOwner)) {
    return { ok: false, errors: ["Remediation owner must be 80 characters or fewer and contain no control characters."], reviews: null };
  }
  if (targetDate !== "" && !validDateOnly(targetDate)) {
    return { ok: false, errors: ["Choose a valid remediation target date."], reviews: null };
  }
  const next = sanitizeExistingReviews(reviews);
  next[controlId] = Object.freeze({
    status: status.value,
    note: note.value.trim(),
    remediationOwner: remediationOwner.trim(),
    dueDate: targetDate,
  });
  return { ok: true, errors: [], reviews: Object.freeze(next) };
}

export function getEvidenceReviewSummary(reviews) {
  const safe = sanitizeExistingReviews(reviews);
  let evidencePresent = 0;
  let gapsFound = 0;
  let notesAdded = 0;
  let remediationAssigned = 0;
  for (const control of SECURITY_CONTROLS) {
    const review = safe[control.id];
    if (!review) continue;
    if (review.status === "evidence-present") evidencePresent += 1;
    if (review.status === "gap-found") gapsFound += 1;
    if (review.note) notesAdded += 1;
    if (review.status === "gap-found" && (review.remediationOwner || review.dueDate)) remediationAssigned += 1;
  }
  return Object.freeze({
    evidencePresent,
    gapsFound,
    notesAdded,
    remediationAssigned,
    notReviewed: SECURITY_CONTROLS.length - evidencePresent - gapsFound,
    totalCount: SECURITY_CONTROLS.length,
  });
}

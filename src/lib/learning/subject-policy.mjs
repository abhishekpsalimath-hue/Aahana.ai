export function normalizeLearningSubject(value) {
  if (typeof value !== "string") return "Anything / explore";
  const subject = value.trim();
  if (!subject || subject.length > 80) return "Anything / explore";
  return subject;
}

"use client";

import { useMemo, useState } from "react";
import styles from "./universe-lab.module.css";

export default function ProjectWorkspace({ worlds, title }) {
  const initial = worlds.map((world, index) => ({
    id: world.id,
    title: world.name,
    notes: world.fact + "\n\n" + world.experiment,
    status: "planned",
    dependencyIds: index ? [worlds[index - 1].id] : [],
    sources: [],
  }));
  const [chapters, setChapters] = useState(initial);
  const [drafts, setDrafts] = useState({});
  const [status, setStatus] = useState("Edit the chapter plan, track progress and attach references you have personally checked.");
  const summary = useMemo(() => ({
    reviewed: chapters.filter((chapter) => chapter.status === "reviewed").length,
    drafted: chapters.filter((chapter) => chapter.status === "drafted").length,
    sources: chapters.reduce((count, chapter) => count + chapter.sources.length, 0),
  }), [chapters]);
  const update = (id, patch) => setChapters((current) => current.map((chapter) => chapter.id === id ? { ...chapter, ...patch } : chapter));
  const move = (id, direction) => setChapters((current) => {
    const index = current.findIndex((chapter) => chapter.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= current.length) return current;
    const next = [...current];
    [next[index], next[target]] = [next[target], next[index]];
    return next;
  });
  const addSource = (id) => {
    const draft = drafts[id] || {};
    const sourceTitle = (draft.title || "").trim();
    const url = (draft.url || "").trim();
    if (!sourceTitle || !url) { setStatus("Add both a source title and URL."); return; }
    let parsed;
    try { parsed = new URL(url); } catch { setStatus("Enter a complete source URL beginning with https://"); return; }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") { setStatus("Only http:// and https:// links are accepted."); return; }
    const source = { id: id + "-" + Date.now(), title: sourceTitle, url: parsed.href, note: (draft.note || "").trim() };
    update(id, { sources: [...(chapters.find((item) => item.id === id)?.sources || []), source] });
    setDrafts((current) => ({ ...current, [id]: { title: "", url: "", note: "" } }));
    setStatus("Reference attached. It is user-supplied and has not been independently verified.");
  };
  const exportText = () => "EDITABLE PROJECT WORKSPACE\n" + title + "\n\n" + chapters.map((chapter, index) => {
    const dependencies = chapter.dependencyIds.map((id) => chapters.find((item) => item.id === id)?.title || id).join(", ") || "None";
    const sources = chapter.sources.map((source) => "- " + source.title + " — " + source.url + "\n  " + (source.note || "No note supplied")).join("\n") || "No sources attached";
    return "CHAPTER " + (index + 1) + ": " + chapter.title + "\nStatus: " + chapter.status + "\nNotes: " + chapter.notes + "\nDependencies: " + dependencies + "\nSources:\n" + sources;
  }).join("\n\n");
  const exportWorkspace = async () => {
    try { await navigator.clipboard.writeText(exportText()); setStatus("Workspace text copied to clipboard."); }
    catch { setStatus("Clipboard unavailable. Use Save project file to keep a portable copy."); }
  };
  const saveProjectFile = () => {
    const payload = { schema: "aahana-universe-project", version: 1, title, exportedAt: new Date().toISOString(), chapters };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = (title || "aahana-project").trim().replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "").slice(0, 60) + ".json";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setStatus("Project file saved. Keep it somewhere safe; Aahana has not uploaded it.");
  };
  const restoreProjectFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 1024 * 1024) { setStatus("That project file is larger than the 1 MB safety limit."); return; }
    try {
      const payload = JSON.parse(await file.text());
      const allowedIds = new Set(worlds.map((world) => world.id));
      const validStatuses = new Set(["planned", "researching", "drafted", "reviewed"]);
      if (payload.schema !== "aahana-universe-project" || payload.version !== 1 || !Array.isArray(payload.chapters) || payload.chapters.length < 2 || payload.chapters.length > 6) throw new Error("This is not a supported Aahana Universe project file.");
      const seen = new Set();
      const restored = payload.chapters.map((chapter) => {
        if (!chapter || !allowedIds.has(chapter.id) || seen.has(chapter.id)) throw new Error("The file contains an unknown or duplicate discovery.");
        seen.add(chapter.id);
        if (typeof chapter.title !== "string" || chapter.title.length > 90 || typeof chapter.notes !== "string" || chapter.notes.length > 2400 || !validStatuses.has(chapter.status)) throw new Error("A chapter contains invalid or oversized fields.");
        if (!Array.isArray(chapter.dependencyIds) || chapter.dependencyIds.some((id) => !allowedIds.has(id) || id === chapter.id)) throw new Error("A chapter contains an invalid dependency.");
        if (!Array.isArray(chapter.sources) || chapter.sources.length > 30) throw new Error("A chapter contains too many references.");
        const sources = chapter.sources.map((source) => {
          if (!source || typeof source.title !== "string" || source.title.length > 140 || typeof source.note !== "string" || source.note.length > 400 || typeof source.url !== "string") throw new Error("A reference contains invalid text.");
          let parsed;
          try { parsed = new URL(source.url); } catch { throw new Error("A reference URL is invalid."); }
          if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Only HTTP(S) reference links can be restored.");
          return { id: String(source.id || chapter.id + "-" + Date.now()), title: source.title, url: parsed.href, note: source.note };
        });
        return { id: chapter.id, title: chapter.title, notes: chapter.notes, status: chapter.status, dependencyIds: chapter.dependencyIds, sources };
      });
      const restoredIds = new Set(restored.map((chapter) => chapter.id));
      if (restored.some((chapter) => chapter.dependencyIds.some((id) => !restoredIds.has(id)))) throw new Error("A dependency points to a discovery that is not included in this project.");
      setChapters(restored);
      setDrafts({});
      setStatus("Project restored from your file. Review the imported chapters and references before relying on them.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not read this project file.");
    }
  };
  return <section className={styles.projectWorkspaceEditor} aria-label="Editable project workspace">
    <div className={styles.projectWorkspaceHead}>
      <div><span className={styles.blueprintLabel}>PROJECT WORKSPACE · SESSION ONLY</span><h4>Shape the work, chapter by chapter.</h4><p>Edit titles and notes, track progress, reorder chapters and attach references you have checked.</p></div>
      <div className={styles.projectWorkspaceActions}>
        <button type="button" onClick={exportWorkspace}>Copy workspace text</button>
        <button type="button" onClick={saveProjectFile}>Save project JSON ↓</button>
        <label className={styles.projectImportButton}>Restore JSON ↑<input type="file" accept="application/json,.json" onChange={restoreProjectFile} /></label>
      </div>
    </div>
    <div className={styles.projectWorkspaceSummary}><span>{summary.reviewed} reviewed</span><span>{summary.drafted} drafted</span><span>{summary.sources} references attached</span></div>
    <div className={styles.projectWorkspaceChapters}>
      {chapters.map((chapter, index) => {
        const draft = drafts[chapter.id] || {};
        return <article className={styles.projectWorkspaceChapter} key={chapter.id}>
          <div className={styles.projectWorkspaceChapterTop}><span>CHAPTER {String(index + 1).padStart(2, "0")}</span><div><button type="button" onClick={() => move(chapter.id, -1)} disabled={index === 0} aria-label={"Move " + chapter.title + " earlier"}>↑</button><button type="button" onClick={() => move(chapter.id, 1)} disabled={index === chapters.length - 1} aria-label={"Move " + chapter.title + " later"}>↓</button></div></div>
          <label>Chapter title<input value={chapter.title} maxLength={90} onChange={(event) => update(chapter.id, { title: event.target.value })} /></label>
          <label>Working notes<textarea value={chapter.notes} rows={4} maxLength={2400} onChange={(event) => update(chapter.id, { notes: event.target.value })} /></label>
          <label>Progress<select value={chapter.status} onChange={(event) => update(chapter.id, { status: event.target.value })}><option value="planned">Planned</option><option value="researching">Researching</option><option value="drafted">Drafted</option><option value="reviewed">Reviewed</option></select></label>
          <label>Depends on<select multiple value={chapter.dependencyIds.filter((id) => id !== chapter.id)} onChange={(event) => update(chapter.id, { dependencyIds: Array.from(event.target.selectedOptions, (option) => option.value) })} aria-label={"Dependencies for " + chapter.title}>{chapters.filter((item) => item.id !== chapter.id).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
          <div className={styles.projectSourceEditor}><strong>References for this chapter</strong>
            {chapter.sources.map((source) => <div className={styles.projectSourceItem} key={source.id}><a href={source.url} target="_blank" rel="noreferrer">{source.title} ↗</a><span>{source.note || "No note supplied"}</span><button type="button" onClick={() => update(chapter.id, { sources: chapter.sources.filter((item) => item.id !== source.id) })}>Remove</button></div>)}
            <label>Source title<input value={draft.title || ""} maxLength={140} onChange={(event) => setDrafts((current) => ({ ...current, [chapter.id]: { ...current[chapter.id], title: event.target.value } }))} placeholder="Paper, article or dataset title" /></label>
            <label>Source URL<input value={draft.url || ""} maxLength={500} onChange={(event) => setDrafts((current) => ({ ...current, [chapter.id]: { ...current[chapter.id], url: event.target.value } }))} placeholder="https://…" inputMode="url" /></label>
            <label>Why is it useful?<textarea value={draft.note || ""} rows={2} maxLength={400} onChange={(event) => setDrafts((current) => ({ ...current, [chapter.id]: { ...current[chapter.id], note: event.target.value } }))} placeholder="Evidence note or limitation" /></label>
            <button type="button" onClick={() => addSource(chapter.id)}>Attach reference +</button>
          </div>
        </article>;
      })}
    </div>
    <p className={styles.projectWorkspaceStatus} role="status" aria-live="polite">{status}</p>
    <p className={styles.gravityCaution}>References are manually supplied and not verified by Aahana. Dependencies are planning links, not proof of scientific causation. No project is uploaded or synced to an account.</p>
  </section>;
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  buildCreatorExport,
  createCreatorDraft,
  CREATOR_DRAFT_STORAGE_KEY,
  validateCreatorDraft,
} from "@/lib/learning/creator-studio-model.mjs";
import "./creator-studio.css";
import NativeImageStudio from "./native-image-studio";
import NativeMotionStudio from "./native-motion-studio";
import Native3DStudio from "./native-3d-studio";
import CreatorCloudAssets from "./creator-cloud-assets";

const visualLabels = {
  diagram: "2D diagram",
  "3d-model": "Interactive 3D model",
  "motion-scene": "Animated scene",
  "knowledge-check": "Knowledge check",
};

export default function CreatorStudio() {
  const [draft, setDraft] = useState(() => createCreatorDraft());
  const [saved, setSaved] = useState(false);
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState(false);
  const [userId, setUserId] = useState(null);
  const [cloudProjectId, setCloudProjectId] = useState(null);
  const [cloudReady, setCloudReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState("Connecting to your private workspace…");

  useEffect(() => {
    let active = true;
    async function restoreWorkspace() {
      const supabase = createClient();
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) throw new Error("Sign in to access your private cloud workspace.");
        if (!active) return;
        setUserId(user.id);

        const { data, error } = await supabase
          .from("creator_workspace_documents")
          .select("project_id, document, updated_at")
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (error) throw error;

        if (data) {
          const restored = validateCreatorDraft(data.document);
          if (restored) {
            setDraft(restored);
            setCloudProjectId(data.project_id);
            window.localStorage.setItem(CREATOR_DRAFT_STORAGE_KEY, JSON.stringify(restored));
            setSyncStatus("Cloud project restored on this device.");
          } else {
            setSyncStatus("A cloud draft needs recovery. Your local backup is still available.");
          }
        } else {
          const raw = window.localStorage.getItem(CREATOR_DRAFT_STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            const candidate = Array.isArray(parsed) ? parsed[0] : parsed;
            const valid = validateCreatorDraft(candidate);
            if (valid) setDraft(valid);
          }
          setSyncStatus("Ready. Save this draft to your private cloud workspace.");
        }
      } catch (error) {
        if (active) setSyncStatus(error?.message || "Cloud workspace is unavailable. Local export remains available.");
        try {
          const raw = window.localStorage.getItem(CREATOR_DRAFT_STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw);
            const candidate = Array.isArray(parsed) ? parsed[0] : parsed;
            const valid = validateCreatorDraft(candidate);
            if (valid) setDraft(valid);
          }
        } catch {
          if (active) setNotice("A local backup could not be opened. You can start a fresh draft.");
        }
      } finally {
        if (active) setCloudReady(true);
      }
    }
    restoreWorkspace();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!cloudReady || !userId || !cloudProjectId) return undefined;
    const valid = validateCreatorDraft(draft);
    if (!valid) return undefined;
    const timer = window.setTimeout(async () => {
      setSyncStatus("Saving changes to your cloud workspace…");
      const supabase = createClient();
      const updatedAt = new Date().toISOString();
      const { error: projectError } = await supabase
        .from("projects")
        .update({ name: valid.title, description: valid.objective || null, updated_at: updatedAt })
        .eq("id", cloudProjectId)
        .eq("user_id", userId);
      if (projectError) {
        setSyncStatus(projectError.message || "Cloud autosave failed. Export a backup before leaving.");
        return;
      }
      const { error } = await supabase
        .from("creator_workspace_documents")
        .upsert({
          project_id: cloudProjectId,
          user_id: userId,
          document: valid,
          schema_version: 1,
          updated_at: updatedAt,
        }, { onConflict: "project_id" });
      if (error) {
        setSyncStatus(error.message || "Cloud autosave failed. Export a backup before leaving.");
        return;
      }
      window.localStorage.setItem(CREATOR_DRAFT_STORAGE_KEY, JSON.stringify(valid));
      setSyncStatus("All changes saved to your private cloud workspace.");
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [draft, cloudProjectId, cloudReady, userId]);

  const sceneCount = draft.scenes.length;
  const activeSummary = useMemo(() => draft.scenes.map((scene, index) => `${index + 1}. ${scene.title}`).join(" · "), [draft.scenes]);

  function updateDraft(patch) {
    setDraft((current) => ({ ...current, ...patch, updatedAt: new Date().toISOString() }));
    setSaved(false);
    setNotice("");
  }

  function updateScene(index, patch) {
    setDraft((current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
      scenes: current.scenes.map((scene, sceneIndex) => sceneIndex === index ? { ...scene, ...patch } : scene),
    }));
    setSaved(false);
    setNotice("");
  }

  function addScene() {
    if (sceneCount >= 30) return;
    setDraft((current) => ({
      ...current,
      updatedAt: new Date().toISOString(),
      scenes: [...current.scenes, { id: `scene-${current.scenes.length + 1}-${Date.now()}`, title: `Scene ${current.scenes.length + 1}`, narration: "", visualType: "diagram", visualNotes: "" }],
    }));
    setSaved(false);
  }

  function removeScene(index) {
    if (sceneCount <= 1) return;
    updateDraft({ scenes: draft.scenes.filter((_, sceneIndex) => sceneIndex !== index) });
  }

  async function saveDraft() {
    const valid = validateCreatorDraft(draft);
    if (!valid) {
      setNotice("Add a title to every scene before saving.");
      return;
    }
    setSyncStatus("Saving your project securely…");
    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw authError || new Error("Sign in again to save your cloud project.");

      let projectId = cloudProjectId;
      if (!projectId) {
        const { data: project, error: projectError } = await supabase
          .from("projects")
          .insert({
            user_id: user.id,
            name: valid.title,
            description: valid.objective || null,
            project_type: "other",
            status: "draft",
          })
          .select("id")
          .single();
        if (projectError) throw projectError;
        projectId = project.id;
      } else {
        const { error: projectError } = await supabase
          .from("projects")
          .update({ name: valid.title, description: valid.objective || null, updated_at: new Date().toISOString() })
          .eq("id", projectId)
          .eq("user_id", user.id);
        if (projectError) throw projectError;
      }

      const { error } = await supabase
        .from("creator_workspace_documents")
        .upsert({
          project_id: projectId,
          user_id: user.id,
          document: valid,
          schema_version: 1,
          updated_at: new Date().toISOString(),
        }, { onConflict: "project_id" });
      if (error) throw error;

      setUserId(user.id);
      setCloudProjectId(projectId);
      setDraft(valid);
      window.localStorage.setItem(CREATOR_DRAFT_STORAGE_KEY, JSON.stringify(valid));
      setSaved(true);
      setSyncStatus("Saved securely to your Aahana cloud workspace.");
      setNotice("Your project is saved to your account and can be reopened on another signed-in device.");
    } catch (error) {
      setSyncStatus(error?.message || "Cloud save failed.");
      setNotice("Cloud save did not complete. Your draft remains on this device; export a backup before leaving.");
    }
  }

  function exportDraft() {
    try {
      const artifact = buildCreatorExport(draft);
      const blob = new Blob([JSON.stringify(artifact, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${draft.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "aahana-learning-draft"}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setNotice("Creator draft exported as JSON. It has not been published.");
    } catch {
      setNotice("Complete the scene titles before exporting this draft.");
    }
  }

  function startFresh() {
    setDraft(createCreatorDraft());
    setCloudProjectId(null);
    setSaved(false);
    setPreview(false);
    setSyncStatus("New draft. Save it to create a separate cloud project.");
    setNotice("New draft started. Your previous cloud project remains saved.");
  }

  return (
    <>
      <NativeImageStudio />
      <NativeMotionStudio />
      <Native3DStudio />
      <CreatorCloudAssets />
      <section className="creator-studio" aria-label="Aahana Creator Studio">
        <div className="creator-studio-heading">
          <div><span>MAKE SOMETHING WORTH DISCOVERING</span><h2>Creator Studio</h2><p>Build a lesson as a sequence of ideas, visuals and learner moments.</p><p className="creator-sync-status" role="status">{syncStatus}</p></div>
          <div className="creator-studio-actions">
            <button type="button" className="creator-secondary" onClick={startFresh}>New draft</button>
            <button type="button" className="creator-primary" onClick={saveDraft}>{saved ? "Saved" : "Save to cloud"}</button>
          </div>
        </div>

        <div className="creator-studio-grid">
          <div className="creator-editor">
            <div className="creator-block-heading"><strong>01 / Learning brief</strong><span>{sceneCount} of 30 scenes</span></div>
            <label>Experience title<input value={draft.title} maxLength={120} onChange={(event) => updateDraft({ title: event.target.value })} placeholder="e.g. Journey through the Solar System" /></label>
            <div className="creator-field-row">
              <label>Subject<input value={draft.subject} maxLength={80} onChange={(event) => updateDraft({ subject: event.target.value })} placeholder="Science, maths, art…" /></label>
              <label>Learner level<select value={draft.learnerLevel} onChange={(event) => updateDraft({ learnerLevel: event.target.value })}><option>Flexible</option><option>Early years</option><option>Primary</option><option>Middle school</option><option>Secondary</option><option>Higher education</option><option>Adult learner</option></select></label>
            </div>
            <label>What should learners understand?<textarea value={draft.objective} maxLength={500} rows={3} onChange={(event) => updateDraft({ objective: event.target.value })} placeholder="Write one clear learning outcome…" /></label>
            <label>Default visual direction<select value={draft.visualStyle} onChange={(event) => updateDraft({ visualStyle: event.target.value })}><option value="motion-scene">Animated storytelling</option><option value="3d-model">Interactive 3D exploration</option><option value="diagram">Clear 2D diagrams</option><option value="knowledge-check">Knowledge checks</option></select></label>

            <div className="creator-block-heading creator-scenes-heading"><strong>02 / Build the sequence</strong><button type="button" onClick={addScene} disabled={sceneCount >= 30}>+ Add scene</button></div>
            {draft.scenes.map((scene, index) => (
              <article className="creator-scene-editor" key={scene.id}>
                <div className="creator-scene-title"><strong>Scene {index + 1}</strong>{sceneCount > 1 && <button type="button" onClick={() => removeScene(index)} aria-label={`Remove scene ${index + 1}`}>Remove</button>}</div>
                <label>Scene title<input value={scene.title} maxLength={120} onChange={(event) => updateScene(index, { title: event.target.value })} /></label>
                <label>Narration / teaching content<textarea rows={3} maxLength={3000} value={scene.narration} onChange={(event) => updateScene(index, { narration: event.target.value })} placeholder="What does Aahana explain in this moment?" /></label>
                <div className="creator-field-row">
                  <label>Visual type<select value={scene.visualType} onChange={(event) => updateScene(index, { visualType: event.target.value })}>{Object.entries(visualLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label>
                  <label>Visual direction<input value={scene.visualNotes} maxLength={1000} onChange={(event) => updateScene(index, { visualNotes: event.target.value })} placeholder="Camera, movement, labels, details…" /></label>
                </div>
              </article>
            ))}
            <div className="creator-studio-actions creator-bottom-actions">
              <button type="button" className="creator-secondary" onClick={() => setPreview((value) => !value)}>{preview ? "Close preview" : "Preview sequence"}</button>
              <button type="button" className="creator-primary" onClick={exportDraft}>Export draft</button>
            </div>
            {notice && <p className="creator-notice" role="status">{notice}</p>}
          </div>

          <aside className="creator-preview">
            <div className="creator-preview-top"><span>LIVE STRUCTURE</span><span className="creator-draft-tag">DRAFT</span></div>
            <h3>{draft.title || "Your learning experience"}</h3>
            <p>{draft.objective || "Your learning objective will appear here."}</p>
            <div className="creator-preview-meta"><span>{draft.subject || "Subject not set"}</span><span>{draft.learnerLevel}</span></div>
            <div className="creator-preview-sequence">
              {draft.scenes.map((scene, index) => <div className="creator-preview-scene" key={scene.id}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{scene.title || "Untitled scene"}</strong><small>{visualLabels[scene.visualType]}</small></div></div>)}
            </div>
            {preview && <div className="creator-preview-detail"><strong>Sequence preview</strong><p>{activeSummary}</p><small>This is a structure preview, not a rendered video or published lesson.</small></div>}
            <div className="creator-preview-foot"><strong>Creator workspace</strong><p>Cloud project saving and a shared private asset library are connected. Media rendering and learner publishing are still separate capabilities.</p></div>
          </aside>
        </div>
      </section>
    </>
  );
}

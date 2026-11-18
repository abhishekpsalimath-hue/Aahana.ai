"use client";

import { useCallback, useEffect, useState } from "react";
import {
  deleteCloudStudioAsset,
  listCloudStudioAssets,
  uploadCloudStudioAsset,
} from "@/lib/studio/cloud-asset-library.mjs";

function formatBytes(value) {
  if (!Number.isFinite(Number(value))) return "";
  const bytes = Number(value);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CreatorCloudAssets({ projectId = null, onAssetUploaded, onAssetDeleted }) {
  const [assets, setAssets] = useState([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("Your private cloud library is ready.");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setAssets(await listCloudStudioAssets());
      setStatus("Private assets are available across your signed-in devices.");
    } catch (error) {
      setStatus(error?.message || "Could not load the cloud Asset Library.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleUpload(event) {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;
    setBusy(true);
    try {
      for (const file of files) {
        const uploaded = await uploadCloudStudioAsset(file, { projectId });
        onAssetUploaded?.(uploaded);
      }
      setStatus(`${files.length} asset${files.length === 1 ? "" : "s"} uploaded to your private cloud library.`);
      await refresh();
    } catch (error) {
      setStatus(error?.message || "Upload failed. Your local files have not been changed.");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(asset) {
    if (!window.confirm(`Delete "${asset.original_filename}" from your cloud library?`)) return;
    setBusy(true);
    try {
      await deleteCloudStudioAsset(asset);
      onAssetDeleted?.(asset);
      setAssets((current) => current.filter((item) => item.id !== asset.id));
      setStatus("Asset deleted from your private cloud library.");
    } catch (error) {
      setStatus(error?.message || "Could not delete this asset.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="creator-cloud-assets" aria-label="Shared private cloud asset library">
      <div className="creator-cloud-assets-heading">
        <div><span>ONE LIBRARY · YOUR ACCOUNT</span><h3>Shared Asset Library</h3><p>Keep images, audio, video, documents, fonts and 3D models together across your Aahana studios.</p></div>
        <label className="creator-cloud-upload">Add assets<input type="file" multiple onChange={handleUpload} disabled={busy} /></label>
      </div>
      <p className="creator-cloud-status" role="status">{busy ? "Working…" : status}</p>
      {loading ? <p className="creator-cloud-empty">Loading your private assets…</p> : assets.length === 0 ? (
        <p className="creator-cloud-empty">No cloud assets yet. Add a file to make it available on your other signed-in devices.</p>
      ) : (
        <div className="creator-cloud-assets-list">
          {assets.map((asset) => (
            <article className="creator-cloud-asset" key={asset.id}>
              <div className="creator-cloud-asset-icon" aria-hidden="true">{asset.mime_type?.startsWith("image/") ? "IMG" : asset.mime_type?.startsWith("video/") ? "VID" : asset.mime_type?.startsWith("audio/") ? "AUD" : asset.mime_type?.startsWith("model/") ? "3D" : "FILE"}</div>
              <div className="creator-cloud-asset-info"><strong>{asset.original_filename}</strong><small>{asset.mime_type || "Unknown type"} · {formatBytes(asset.size_bytes)}</small></div>
              {asset.signedUrl && <a href={asset.signedUrl} target="_blank" rel="noreferrer">Open</a>}
              <button type="button" onClick={() => handleDelete(asset)} disabled={busy}>Delete</button>
            </article>
          ))}
        </div>
      )}
      <small className="creator-cloud-assets-foot">Private to your account · 50 MB per file · temporary access links expire after 1 hour</small>
    </section>
  );
}

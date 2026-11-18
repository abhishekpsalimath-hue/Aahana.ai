"use client";

import { createClient } from "@/lib/supabase/client";

export const STUDIO_ASSET_BUCKET = "aahana-studio-assets";
export const STUDIO_ASSET_MAX_BYTES = 50 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "image/png", "image/jpeg", "image/webp", "image/gif", "image/avif",
  "audio/mpeg", "audio/mp4", "audio/wav", "audio/ogg", "audio/webm",
  "video/mp4", "video/webm", "video/ogg",
  "model/gltf-binary", "model/gltf+json", "application/octet-stream",
  "font/woff", "font/woff2", "font/ttf", "application/pdf", "text/plain",
]);

function safeFilename(name) {
  return String(name || "asset")
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100) || "asset";
}

export async function uploadCloudStudioAsset(file, { projectId = null } = {}) {
  if (typeof File === "undefined" || !(file instanceof File)) {
    throw new TypeError("Choose a valid file.");
  }
  if (file.size < 1 || file.size > STUDIO_ASSET_MAX_BYTES) {
    throw new RangeError("Cloud assets must be between 1 byte and 50 MB.");
  }
  const mimeType = String(file.type || "application/octet-stream").toLowerCase();
  if (!ALLOWED_TYPES.has(mimeType)) {
    throw new TypeError("This file type is not supported by the shared Asset Library.");
  }

  const supabase = createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error("Sign in again to upload to your private workspace.");

  const assetId = crypto.randomUUID();
  const objectPath = `${user.id}/library/${assetId}-${safeFilename(file.name)}`;
  const { error: uploadError } = await supabase.storage
    .from(STUDIO_ASSET_BUCKET)
    .upload(objectPath, file, { contentType: mimeType, upsert: false });
  if (uploadError) throw uploadError;

  const { data, error: recordError } = await supabase
    .from("user_files")
    .insert({
      user_id: user.id,
      project_id: projectId,
      bucket_id: STUDIO_ASSET_BUCKET,
      object_path: objectPath,
      original_filename: String(file.name || "Untitled asset").slice(0, 180),
      mime_type: mimeType,
      size_bytes: file.size,
    })
    .select("id, original_filename, mime_type, size_bytes, object_path, created_at, project_id")
    .single();

  if (recordError) {
    await supabase.storage.from(STUDIO_ASSET_BUCKET).remove([objectPath]);
    throw recordError;
  }
  return data;
}

export async function listCloudStudioAssets() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("user_files")
    .select("id, original_filename, mime_type, size_bytes, object_path, created_at, project_id, bucket_id")
    .eq("bucket_id", STUDIO_ASSET_BUCKET)
    .order("created_at", { ascending: false });
  if (error) throw error;

  return Promise.all((data || []).map(async (asset) => {
    const { data: signed, error: signedError } = await supabase.storage
      .from(STUDIO_ASSET_BUCKET)
      .createSignedUrl(asset.object_path, 3600);
    return { ...asset, signedUrl: signedError ? null : signed?.signedUrl || null };
  }));
}

export async function deleteCloudStudioAsset(asset) {
  if (!asset?.id || !asset?.object_path) throw new TypeError("Choose a valid asset to delete.");
  const supabase = createClient();
  const { error: storageError } = await supabase.storage
    .from(STUDIO_ASSET_BUCKET)
    .remove([asset.object_path]);
  if (storageError) throw storageError;

  const { error: recordError } = await supabase
    .from("user_files")
    .delete()
    .eq("id", asset.id)
    .eq("bucket_id", STUDIO_ASSET_BUCKET);
  if (recordError) throw recordError;
}

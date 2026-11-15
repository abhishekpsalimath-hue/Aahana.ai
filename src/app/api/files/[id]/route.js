import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_request, { params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const { data: file, error } = await supabase.from("user_files")
    .select("id, bucket_id, object_path, original_filename")
    .eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error || !file) return NextResponse.json({ error: "File not found." }, { status: 404 });

  const { data, error: signError } = await supabase.storage.from(file.bucket_id).createSignedUrl(file.object_path, 60);
  if (signError || !data?.signedUrl) return NextResponse.json({ error: "Could not open this file." }, { status: 500 });
  return NextResponse.json({ url: data.signedUrl, filename: file.original_filename });
}

export async function DELETE(_request, { params }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const { data: file, error } = await supabase.from("user_files")
    .select("id, bucket_id, object_path").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (error || !file) return NextResponse.json({ error: "File not found." }, { status: 404 });

  const { error: storageError } = await supabase.storage.from(file.bucket_id).remove([file.object_path]);
  if (storageError) return NextResponse.json({ error: "Could not delete the stored file." }, { status: 500 });
  const { error: deleteError } = await supabase.from("user_files").delete().eq("id", id).eq("user_id", user.id);
  if (deleteError) return NextResponse.json({ error: "File was removed from storage but its record could not be deleted." }, { status: 500 });
  return NextResponse.json({ success: true });
}

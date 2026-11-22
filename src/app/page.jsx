import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AssistantWorkspace from "./assistant-workspace";

// Authentication-dependent output must never be statically generated or cached.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;

  if (error || !claims?.sub) redirect("/login");

  return (
    <AssistantWorkspace
      userEmail={typeof claims.email === "string" ? claims.email : ""}
      aiEnabled={process.env.AAHANA_AI_ENABLED === "true"}
    />
  );
}

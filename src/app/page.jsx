import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AssistantWorkspace from "./assistant-workspace";

// Explicitly bind this route to the incoming request. This prevents a
// build-time unauthenticated redirect from being reused for signed-in users.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  await connection();

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

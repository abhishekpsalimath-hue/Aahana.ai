import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AssistantWorkspace from "./assistant-workspace";

export default async function Home() {
  const supabase = await createClient();

  // The request proxy has already refreshed and verified the Supabase session.
  // Read its verified JWT claims here instead of making a second Auth API
  // request with getUser(), which can make workspace navigation depend on an
  // additional network round-trip.
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

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AssistantWorkspace from "./assistant-workspace";

export default async function Home() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return <AssistantWorkspace userEmail={user.email ?? ""} aiEnabled={process.env.AAHANA_AI_ENABLED === "true"} />;
}

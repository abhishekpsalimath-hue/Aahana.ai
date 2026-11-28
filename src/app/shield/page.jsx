import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ShieldWorkspace from "./shield-workspace";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export default async function ShieldPage() {
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/login");
  return <ShieldWorkspace />;
}

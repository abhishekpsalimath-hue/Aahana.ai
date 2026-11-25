import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import UniverseLab from "./universe-lab";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = {
  title: "Universe Experiment | Aahana AI",
  robots: { index: false, follow: false },
};

export default async function UniverseLabPage() {
  await connection();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect("/login");
  return <UniverseLab />;
}

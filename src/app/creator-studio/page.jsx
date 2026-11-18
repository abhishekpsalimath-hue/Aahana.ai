import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CreatorStudio from "../learn/creator-studio";

export default async function CreatorStudioPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return (
    <main className="learning-page">
      <header className="learning-header">
        <Link className="learning-brand" href="/">Aahana <span>ai</span></Link>
        <nav><Link href="/">Assistant</Link><span className="learning-user">{user.email ?? "Your workspace"}</span></nav>
      </header>
      <section className="learning-hero student-welcome">
        <div className="learning-kicker">CREATE MODE</div>
        <h1>Creator <em>Studio.</em></h1>
        <p>A dedicated workspace to design lessons, visual experiences and interactive learning content.</p>
      </section>
      <CreatorStudio />
      <footer className="learning-footer"><span>Aahana Creator Studio</span><span>Make something worth discovering.</span></footer>
    </main>
  );
}

import Link from "next/link";

export const metadata = {
  title: "Aahana AI — Think beyond",
  description: "Meet Aahana, a general-purpose AI workspace for solving problems, creating, writing, building and improving ideas.",
  alternates: { canonical: "/discover" },
  openGraph: {
    title: "Aahana AI — Think beyond",
    description: "A general-purpose AI workspace to solve, create, write, build and improve.",
    type: "website",
    url: "/discover",
  },
};

const modes = [
  ["Solve", "Work through questions, problems and complex ideas."],
  ["Create", "Explore ideas and shape them into something useful."],
  ["Write", "Draft, refine and improve written work."],
  ["Build", "Think through software, workflows and practical projects."],
  ["Improve", "Review, strengthen and iterate on what you are working on."],
];

export default function DiscoverPage() {
  return (
    <main className="discover-shell">
      <nav className="discover-nav" aria-label="Main navigation">
        <Link className="brand discover-brand" href="/discover">
          <span className="brand-word">Aahana</span><span className="brand-ai">AI</span>
        </Link>
        <Link className="discover-nav-link" href="/login">Sign in</Link>
      </nav>

      <section className="discover-hero">
        <div className="discover-orb" aria-hidden="true"><span /><i /><b /></div>
        <p className="discover-eyebrow">A GENERAL-PURPOSE AI WORKSPACE</p>
        <h1>Think <em>beyond.</em></h1>
        <p className="discover-lead">
          Aahana brings a thoughtful AI workspace into one place — helping you
          solve, create, write, build and improve.
        </p>
        <div className="discover-actions">
          <Link className="discover-primary" href="/login">Explore Aahana <span aria-hidden="true">↗</span></Link>
          <span className="discover-note">Sign in or create an account to get started.</span>
        </div>
      </section>

      <section className="discover-modes" aria-labelledby="modes-heading">
        <p className="discover-eyebrow">ONE WORKSPACE, MANY WAYS TO THINK</p>
        <h2 id="modes-heading">Move from a question to what comes next.</h2>
        <div className="discover-mode-grid">
          {modes.map(([name, description], index) => (
            <article className="discover-mode-card" key={name}>
              <span className="discover-mode-index">0{index + 1}</span>
              <h3>{name}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="discover-detail">
        <div>
          <p className="discover-eyebrow">YOUR WORK, IN CONTEXT</p>
          <h2>A space for ongoing work.</h2>
        </div>
        <p>
          Aahana includes private accounts, conversation history and project
          workspaces, so you can return to the work you have started. Available
          capabilities can depend on product configuration and provider
          availability.
        </p>
      </section>

      <section className="discover-final">
        <p className="discover-eyebrow">BEGIN WITH AN IDEA</p>
        <h2>Make room for what you can think next.</h2>
        <Link className="discover-primary" href="/login">Get started <span aria-hidden="true">↗</span></Link>
      </section>

      <footer className="discover-footer">
        <span>AAHANA AI</span>
        <span>Think beyond.</span>
      </footer>
    </main>
  );
}

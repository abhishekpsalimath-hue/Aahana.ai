import Link from "next/link";
import styles from "./share.module.css";

export const metadata = {
  title: "Aahana AI — Good ideas start somewhere",
  description: "A little introduction to Aahana AI, a personal project built around curiosity, creativity and possibility.",
  robots: { index: true, follow: true },
};

export default function SharePage() {
  return (
    <main className={styles.page}>
      <div className={styles.ambient} aria-hidden="true">
        <span className={styles.glow} />
        <div className={styles.starField}>
          {Array.from({ length: 20 }, (_, index) => <span key={index} />)}
        </div>
      </div>

      <header className={styles.header}>
        <Link className={styles.brand} href="/share" aria-label="Aahana AI">
          <span>Aahana</span><span className={styles.chip}>ai</span>
        </Link>
        <span className={styles.headerNote}>A SMALL INTRODUCTION</span>
      </header>

      <section className={styles.hero}>
        <div className={styles.orbit} aria-hidden="true">
          <span className={styles.orbitRing} />
          <span className={styles.orbitRingTwo} />
          <span className={styles.orbitCore} />
          <span className={styles.orbitSpark} />
        </div>

        <p className={styles.eyebrow}><span /> SOMETHING I’M BUILDING</p>
        <h1>Good ideas<br /><em>start somewhere.</em></h1>
        <p className={styles.intro}>
          Meet <strong>Aahana AI</strong> — a personal project I’m building around
          curiosity, creativity, and the belief that every good idea deserves room to grow.
        </p>

        <div className={styles.note}>
          <span className={styles.noteMark}>✦</span>
          <p>It’s still a work in progress, but it means a lot to me. I wanted you to be among the first to see it.</p>
        </div>

        <div className={styles.actions}>
          <Link className={styles.primary} href="/login">Explore Aahana <span aria-hidden="true">↗</span></Link>
          <span className={styles.smallNote}>A first look at the journey.</span>
        </div>
      </section>

      <footer className={styles.footer}>
        <span>Aahana <b>ai</b></span>
        <span>Thoughtfully made, one idea at a time.</span>
      </footer>
    </main>
  );
}

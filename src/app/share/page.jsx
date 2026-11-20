import Link from "next/link";
import styles from "./share.module.css";

export const metadata = {
  title: "Aahana AI — Good ideas start somewhere",
  description: "A welcome to Aahana AI from its founder, Abhishekayya Salimath.",
  robots: { index: true, follow: true },
};

const STAR_COUNT = 220;

export default function SharePage() {
  return (
    <main className={styles.page}>
      <div className={styles.ambient} aria-hidden="true">
        <span className={styles.glow} />
        <div className={styles.starField}>
          {Array.from({ length: STAR_COUNT }, (_, index) => (
            <span
              key={index}
              style={{
                top: `${(index * 73.97 + 11.3) % 100}%`,
                left: `${(index * 47.13 + 5.7) % 100}%`,
                animationDelay: `-${(index * 0.37) % 6}s`,
              }}
            />
          ))}
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

        <p className={styles.eyebrow}><span /> A WELCOME FROM THE FOUNDER</p>
        <h1>Good ideas<br /><em>start somewhere.</em></h1>
        <p className={styles.intro}>
          A warm welcome to everyone joining <strong>Aahana AI</strong>.
          I’m <strong>Abhishekayya Salimath</strong>, and I’m building Aahana
          as a space where curiosity can turn into clarity, ideas can become
          creations, and questions can lead to new possibilities.
        </p>

        <div className={styles.note}>
          <span className={styles.noteMark}>✦</span>
          <p>
            Whether you’re learning, researching, writing, designing, coding,
            or exploring something new, I hope Aahana helps you move your ideas forward.
            Your feedback will help shape what comes next.
          </p>
        </div>

        <div className={styles.actions}>
          <Link className={styles.primary} href="/login">Explore Aahana <span aria-hidden="true">↗</span></Link>
          <span className={styles.smallNote}>Built with curiosity by Abhishekayya Salimath.</span>
        </div>
      </section>

      <footer className={styles.footer}>
        <span>Aahana <b>ai</b></span>
        <span>Thoughtfully made, one idea at a time.</span>
      </footer>
    </main>
  );
}

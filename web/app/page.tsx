import Link from "next/link";

import styles from "./page.module.css";

export default function HomePage() {
  return (
    <section className={`${styles.hero} site-shell`} aria-labelledby="home-title">
      <p className={styles.eyebrow}>CS2 skin discovery</p>
      <h1 id="home-title">Find your next SkinRush favourite.</h1>
      <p className={styles.intro}>
        The permanent SkinRush experience is taking shape. Start with the Skin Database,
        built to make browsing the catalogue clear and focused.
      </p>
      <Link className={styles.action} href="/skins">
        Explore skins
      </Link>
    </section>
  );
}

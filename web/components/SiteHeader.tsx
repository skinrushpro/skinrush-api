import Link from "next/link";

import styles from "./SiteHeader.module.css";

const navigation = [
  { href: "/", label: "Home" },
  { href: "/skins", label: "Skin Database" },
] as const;

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={`${styles.inner} site-shell`}>
        <Link className={styles.brand} href="/" aria-label="SkinRush home">
          SkinRush
        </Link>
        <nav aria-label="Primary navigation">
          <ul className={styles.navigation}>
            {navigation.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}

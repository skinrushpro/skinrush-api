import type { Metadata } from "next";

import { SkinsCatalogue } from "@/components/SkinsCatalogue";
import styles from "./page.module.css";

export const metadata: Metadata = {
  title: "Skin Database",
  description: "Browse the SkinRush CS2 skin catalogue.",
};

export default function SkinsPage() {
  return (
    <section className={`${styles.page} site-shell`} aria-labelledby="skins-title">
      <p className={styles.eyebrow}>Catalogue</p>
      <h1 id="skins-title">Skin Database</h1>
      <p className={styles.intro}>Browse the first page of the live SkinRush catalogue.</p>
      <SkinsCatalogue />
    </section>
  );
}

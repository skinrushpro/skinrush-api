"use client";

import { useEffect, useState } from "react";

import { parseCataloguePage, type CataloguePage } from "@/lib/catalogue-contract";
import styles from "./SkinsCatalogue.module.css";

type CatalogueState =
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; page: CataloguePage };

export function SkinsCatalogue() {
  const [state, setState] = useState<CatalogueState>({ status: "loading" });
  const [requestNumber, setRequestNumber] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadCatalogue() {
      setState({ status: "loading" });
      try {
        const response = await fetch("/api/catalogue/skins?limit=25", {
          headers: { Accept: "application/json" },
          signal: controller.signal,
        });
        const body: unknown = await response.json();
        const page = response.ok ? parseCataloguePage(body) : null;
        if (!page) throw new Error("Invalid catalogue response");
        setState({ status: "ready", page });
      } catch (error) {
        if (controller.signal.aborted) return;
        setState({ status: "error" });
      }
    }

    void loadCatalogue();
    return () => controller.abort();
  }, [requestNumber]);

  if (state.status === "loading") {
    return <p className={styles.status} role="status">Loading the Skin Database…</p>;
  }

  if (state.status === "error") {
    return (
      <div className={styles.status} role="alert">
        <p>The Skin Database is temporarily unavailable.</p>
        <button type="button" onClick={() => setRequestNumber((value) => value + 1)}>
          Try again
        </button>
      </div>
    );
  }

  return (
    <section aria-labelledby="catalogue-results">
      <h2 className={styles.summary} id="catalogue-results">
        {state.page.total.toLocaleString("en-GB")} skins found
      </h2>
      <ul className={styles.results}>
        {state.page.items.map((skin) => (
          <li className={styles.result} key={skin.id}>
            <span className={styles.weapon}>{skin.weapon}</span>
            <strong>{skin.name}</strong>
            <span className={styles.rarity}>{skin.rarity ?? "Unclassified"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

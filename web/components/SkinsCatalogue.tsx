"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { CatalogueApi } from "@/lib/catalogue-api";
import { CatalogueController, type CatalogueSnapshot } from "@/lib/catalogue-controller";
import { createDefaultFilterState, type ListFilterKey, type ScalarFilterKey } from "@/lib/filter-state";
import styles from "./SkinsCatalogue.module.css";

const EMPTY_SNAPSHOT: CatalogueSnapshot = {
  state: createDefaultFilterState(),
  options: { weapons: [], collections: [], cases: [], sourceTypes: [], rarities: [], wears: [] },
  items: [], total: 0, loading: true, error: null,
};

const SORT_OPTIONS = [
  ["weapon_asc", "Weapon A–Z"], ["name_asc", "Skin name A–Z"],
  ["rarity_desc", "Rarity high–low"], ["rarity_asc", "Rarity low–high"],
  ["float_min_asc", "Minimum float low–high"], ["float_max_desc", "Maximum float high–low"],
] as const;

interface MultiFilterProps {
  label: string;
  filterKey: ListFilterKey;
  options: Array<{ value: string; label: string }>;
  selected: string[];
  onToggle(key: ListFilterKey, value: string): void;
}

function MultiFilter({ label, filterKey, options, selected, onToggle }: MultiFilterProps) {
  return (
    <details className={styles.filterMenu}>
      <summary>{label}{selected.length ? ` (${selected.length})` : ""}</summary>
      <fieldset>
        <legend className="sr-only">{label}</legend>
        {options.map((option) => (
          <label key={option.value}>
            <input type="checkbox" checked={selected.includes(option.value)} onChange={() => onToggle(filterKey, option.value)} />
            <span>{option.label}</span>
          </label>
        ))}
        {options.length === 0 ? <span className={styles.noOptions}>Loading options…</span> : null}
      </fieldset>
    </details>
  );
}

export function SkinsCatalogue() {
  const [snapshot, setSnapshot] = useState<CatalogueSnapshot>(EMPTY_SNAPSHOT);
  const controllerRef = useRef<CatalogueController | null>(null);

  useEffect(() => {
    const controller = new CatalogueController({
      api: new CatalogueApi(),
      history: {
        read: () => new URLSearchParams(window.location.search),
        push: (params) => {
          const url = new URL(window.location.href);
          url.search = params.toString();
          window.history.pushState({}, "", url);
        },
        subscribe: (handler) => {
          window.addEventListener("popstate", handler);
          return () => window.removeEventListener("popstate", handler);
        },
      },
      onChange: setSnapshot,
    });
    controllerRef.current = controller;
    controller.connect();
    return () => {
      controller.disconnect();
      controllerRef.current = null;
    };
  }, []);

  const listOptions = useMemo(() => ({
    weapons: snapshot.options.weapons.map((value) => ({ value, label: value })),
    collections: snapshot.options.collections.map(({ id, name }) => ({ value: id, label: name })),
    cases: snapshot.options.cases.map(({ id, name }) => ({ value: id, label: name })),
    sourceTypes: snapshot.options.sourceTypes.map((value) => ({ value, label: value.replaceAll("_", " ") })),
    rarities: snapshot.options.rarities.map((value) => ({ value, label: value })),
    wears: snapshot.options.wears.map(({ name }) => ({ value: name, label: name })),
  }), [snapshot.options]);

  const chips = useMemo(() => {
    const output: Array<{ key: ListFilterKey | ScalarFilterKey; value?: string; label: string }> = [];
    if (snapshot.state.search) output.push({ key: "search", label: `Search: ${snapshot.state.search}` });
    for (const [key, label] of [
      ["weapons", "Weapon"], ["collections", "Collection"], ["cases", "Case"],
      ["sourceTypes", "Source"], ["rarities", "Rarity"], ["wears", "Wear"],
    ] as const) {
      for (const value of snapshot.state[key]) output.push({ key, value, label: `${label}: ${value}` });
    }
    if (snapshot.state.stattrak !== null) output.push({ key: "stattrak", label: `StatTrak™: ${snapshot.state.stattrak ? "Yes" : "No"}` });
    if (snapshot.state.souvenir !== null) output.push({ key: "souvenir", label: `Souvenir: ${snapshot.state.souvenir ? "Yes" : "No"}` });
    if (snapshot.state.floatMin !== null) output.push({ key: "floatMin", label: `Float min: ${snapshot.state.floatMin}` });
    if (snapshot.state.floatMax !== null) output.push({ key: "floatMax", label: `Float max: ${snapshot.state.floatMax}` });
    return output;
  }, [snapshot.state]);

  const updateFloat = (key: "floatMin" | "floatMax", raw: string) => {
    const value = raw === "" ? null : Number(raw);
    if (value !== null && (!Number.isFinite(value) || value < 0 || value > 1)) return;
    const patch = key === "floatMin"
      ? { floatMin: value, floatMax: value !== null && snapshot.state.floatMax !== null && value > snapshot.state.floatMax ? null : snapshot.state.floatMax }
      : { floatMax: value, floatMin: value !== null && snapshot.state.floatMin !== null && value < snapshot.state.floatMin ? null : snapshot.state.floatMin };
    controllerRef.current?.update(patch, true);
  };

  const previousOffset = Math.max(0, snapshot.state.offset - snapshot.state.limit);
  const nextOffset = snapshot.state.offset + snapshot.state.limit;

  return (
    <div className={styles.catalogue}>
      <div className={styles.primaryControls}>
        <label><span>Search</span><input type="search" value={snapshot.state.search} onChange={(event) => controllerRef.current?.update({ search: event.target.value }, true)} placeholder="Skin or weapon name" /></label>
        <label><span>Sort by</span><select value={snapshot.state.sort} onChange={(event) => controllerRef.current?.setSort(event.target.value as typeof snapshot.state.sort)}>{SORT_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      </div>

      <div className={styles.filterGrid}>
        <MultiFilter label="Weapon" filterKey="weapons" options={listOptions.weapons} selected={snapshot.state.weapons} onToggle={(key, value) => controllerRef.current?.toggleListValue(key, value)} />
        <MultiFilter label="Collection" filterKey="collections" options={listOptions.collections} selected={snapshot.state.collections} onToggle={(key, value) => controllerRef.current?.toggleListValue(key, value)} />
        <MultiFilter label="Case" filterKey="cases" options={listOptions.cases} selected={snapshot.state.cases} onToggle={(key, value) => controllerRef.current?.toggleListValue(key, value)} />
        <MultiFilter label="Source type" filterKey="sourceTypes" options={listOptions.sourceTypes} selected={snapshot.state.sourceTypes} onToggle={(key, value) => controllerRef.current?.toggleListValue(key, value)} />
        <MultiFilter label="Rarity" filterKey="rarities" options={listOptions.rarities} selected={snapshot.state.rarities} onToggle={(key, value) => controllerRef.current?.toggleListValue(key, value)} />
        <MultiFilter label="Wear" filterKey="wears" options={listOptions.wears} selected={snapshot.state.wears} onToggle={(key, value) => controllerRef.current?.toggleListValue(key, value)} />
      </div>

      <div className={styles.secondaryControls}>
        {(["stattrak", "souvenir"] as const).map((key) => (
          <label key={key}><span>{key === "stattrak" ? "StatTrak™" : "Souvenir"}</span><select value={snapshot.state[key] === null ? "" : String(snapshot.state[key])} onChange={(event) => controllerRef.current?.update({ [key]: event.target.value === "" ? null : event.target.value === "true" })}><option value="">Any</option><option value="true">Yes</option><option value="false">No</option></select></label>
        ))}
        <label><span>Float min</span><input type="number" min="0" max="1" step="0.01" value={snapshot.state.floatMin ?? ""} onChange={(event) => updateFloat("floatMin", event.target.value)} /></label>
        <label><span>Float max</span><input type="number" min="0" max="1" step="0.01" value={snapshot.state.floatMax ?? ""} onChange={(event) => updateFloat("floatMax", event.target.value)} /></label>
      </div>

      {chips.length ? <div className={styles.chips} aria-label="Active filters">{chips.map((chip) => <button key={`${chip.key}-${chip.value ?? "scalar"}`} type="button" onClick={() => controllerRef.current?.remove(chip.key, chip.value)}>{chip.label} <span aria-hidden="true">×</span></button>)}<button className={styles.clear} type="button" onClick={() => controllerRef.current?.clear()}>Clear all</button></div> : null}

      {snapshot.error ? <div className={styles.status} role="alert"><p>{snapshot.error}</p><button type="button" onClick={() => controllerRef.current?.retry()}>Try again</button></div> : null}
      {snapshot.loading ? <p className={styles.loading} role="status">Loading the Skin Database…</p> : null}
      {!snapshot.loading && !snapshot.error && snapshot.items.length === 0 ? <p className={styles.status}>No skins match these filters.</p> : null}
      {snapshot.items.length ? <section aria-labelledby="catalogue-results"><h2 className={styles.summary} id="catalogue-results">{snapshot.total.toLocaleString("en-GB")} skins found</h2><ul className={styles.results}>{snapshot.items.map((skin) => <li className={styles.result} key={skin.id}><span className={styles.weapon}>{skin.weapon}</span><strong>{skin.name}</strong><span className={styles.rarity}>{skin.rarity ?? "Unclassified"}</span></li>)}</ul><nav className={styles.pagination} aria-label="Skin results pages"><button type="button" disabled={snapshot.state.offset === 0 || snapshot.loading} onClick={() => controllerRef.current?.goToOffset(previousOffset)}>Previous</button><span>Results {snapshot.state.offset + 1}–{Math.min(nextOffset, snapshot.total)} of {snapshot.total.toLocaleString("en-GB")}</span><button type="button" disabled={nextOffset >= snapshot.total || snapshot.loading} onClick={() => controllerRef.current?.goToOffset(nextOffset)}>Next</button></nav></section> : null}
    </div>
  );
}

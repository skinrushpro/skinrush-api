import assert from "node:assert/strict";
import test from "node:test";

import {
  CatalogueController,
  type CatalogueSnapshot,
} from "../lib/catalogue-controller.ts";
import { createDefaultFilterState, type FilterState } from "../lib/filter-state.ts";
import type { CataloguePage, FilterOptions } from "../lib/catalogue-contract.ts";

const options: FilterOptions = {
  weapons: ["AK-47", "AWP", "Butterfly Knife", "Karambit", "Zeus x27"],
  weaponCategories: [
    { id: "rifles", name: "Rifles", weapons: ["AK-47", "AWP"] },
    { id: "pistols", name: "Pistols", weapons: [] },
    { id: "smgs", name: "SMGs", weapons: [] },
    { id: "heavy", name: "Heavy", weapons: [] },
    { id: "knives", name: "Knives", weapons: ["Butterfly Knife", "Karambit"] },
    { id: "gloves", name: "Gloves", weapons: [] },
    { id: "equipment", name: "Equipment", weapons: ["Zeus x27"] },
  ],
  collections: [], cases: [], sourceTypes: [], rarities: [], wears: [],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function harness() {
  const searches: Array<{
    state: FilterState;
    signal: AbortSignal;
    result: ReturnType<typeof deferred<CataloguePage>>;
  }> = [];
  const snapshots: CatalogueSnapshot[] = [];
  let params = new URLSearchParams("campaign=summer");
  let popHandler: (() => void) | null = null;
  let timer: (() => void) | null = null;
  const controller = new CatalogueController({
    api: {
      loadOptions: async () => options,
      search: (state, signal) => {
        const result = deferred<CataloguePage>();
        searches.push({ state: structuredClone(state), signal, result });
        return result.promise;
      },
    },
    history: {
      read: () => new URLSearchParams(params),
      push: (next) => { params = new URLSearchParams(next); },
      subscribe: (handler) => { popHandler = handler; return () => { popHandler = null; }; },
    },
    scheduler: {
      set: (callback) => { timer = callback; return 1; },
      clear: () => { timer = null; },
    },
    onChange: (snapshot) => snapshots.push(structuredClone(snapshot)),
  });
  return {
    controller, searches, snapshots,
    params: () => params,
    setParams: (next: string) => { params = new URLSearchParams(next); },
    pop: () => popHandler?.(),
    flush: () => { const callback = timer; timer = null; callback?.(); },
  };
}

test("connect restores URL state and loads options plus results", async () => {
  const h = harness();
  h.setParams("campaign=summer&weapon=FAMAS");
  h.controller.connect();
  await Promise.resolve();
  assert.deepEqual(h.searches[0].state.weapons, ["FAMAS"]);
  assert.deepEqual(h.snapshots.at(-1)?.options, options);
});

test("search changes debounce while selections refresh immediately", () => {
  const h = harness();
  h.controller.connect();
  h.controller.update({ weapons: ["AK-47"] }, false);
  assert.equal(h.searches.length, 2);
  h.controller.update({ search: "asiimov" }, true);
  assert.equal(h.searches.length, 2);
  assert.equal(h.snapshots.at(-1)?.state.search, "asiimov");
  h.flush();
  assert.equal(h.searches.length, 3);
});

test("superseded requests abort and cannot overwrite newer results", async () => {
  const h = harness();
  h.controller.connect();
  h.controller.update({ weapons: ["FAMAS"] }, false);
  assert.equal(h.searches[0].signal.aborted, true);
  h.searches[1].result.resolve({ items: [], total: 2 });
  await Promise.resolve();
  h.searches[0].result.resolve({ items: [], total: 99 });
  await Promise.resolve();
  assert.equal(h.snapshots.at(-1)?.total, 2);
});

test("sort, list toggles, clear, pagination, and popstate share one URL pipeline", () => {
  const h = harness();
  h.controller.connect();
  h.controller.goToOffset(25);
  h.controller.setSort("rarity_desc");
  h.controller.toggleListValue("weapons", "AK-47");
  assert.equal(h.params().get("sort"), "rarity_desc");
  assert.equal(h.params().get("weapon"), "AK-47");
  assert.equal(h.params().has("offset"), false);
  h.controller.clear();
  assert.equal(h.params().get("campaign"), "summer");
  assert.equal(h.params().get("sort"), "rarity_desc");
  h.setParams("campaign=summer&rarity=Covert");
  h.pop();
  assert.deepEqual(h.searches.at(-1)?.state.rarities, ["Covert"]);
});

test("active category changes remove incompatible models and keep compatible ones", async () => {
  const h = harness();
  h.setParams("category=rifles,knives&weapon=AK-47,Karambit");
  h.controller.connect();
  await Promise.resolve();

  h.controller.toggleCategory("knives");

  assert.deepEqual(h.controller.snapshot.state.categories, ["rifles"]);
  assert.deepEqual(h.controller.snapshot.state.weapons, ["AK-47"]);
  assert.equal(h.params().get("category"), "rifles");
  assert.equal(h.params().get("weapon"), "AK-47");
});

test("compatible models survive multi-category changes and no category restores all choices", async () => {
  const h = harness();
  h.setParams("category=rifles&weapon=AK-47");
  h.controller.connect();
  await Promise.resolve();

  h.controller.toggleCategory("knives");
  assert.deepEqual(h.controller.snapshot.state.categories, ["rifles", "knives"]);
  assert.deepEqual(h.controller.snapshot.state.weapons, ["AK-47"]);

  h.controller.toggleCategory("rifles");
  assert.deepEqual(h.controller.snapshot.state.categories, ["knives"]);
  assert.deepEqual(h.controller.snapshot.state.weapons, []);

  h.controller.toggleCategory("knives");
  assert.deepEqual(h.controller.snapshot.state.categories, []);
  assert.deepEqual(h.controller.availableWeapons, options.weapons);
});

test("category chip removal and popstate use the existing history pipeline", async () => {
  const h = harness();
  h.setParams("campaign=summer&category=knives,equipment&weapon=Karambit,Zeus+x27");
  h.controller.connect();
  await Promise.resolve();

  h.controller.remove("categories", "knives");
  assert.deepEqual(h.controller.snapshot.state.categories, ["equipment"]);
  assert.deepEqual(h.controller.snapshot.state.weapons, ["Zeus x27"]);
  h.setParams("campaign=summer&category=rifles&weapon=AK-47");
  h.pop();
  assert.deepEqual(h.searches.at(-1)?.state.categories, ["rifles"]);
  assert.deepEqual(h.searches.at(-1)?.state.weapons, ["AK-47"]);
});

test("disconnect aborts work and prevents future popstate requests", () => {
  const h = harness();
  h.controller.connect();
  h.controller.update({ search: "dragon" }, true);
  h.controller.disconnect();
  assert.equal(h.searches[0].signal.aborted, true);
  const count = h.searches.length;
  h.pop();
  assert.equal(h.searches.length, count);
  assert.deepEqual(createDefaultFilterState().weapons, []);
});

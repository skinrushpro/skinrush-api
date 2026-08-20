import assert from "node:assert/strict";
import test from "node:test";

import { CatalogueApi } from "../lib/catalogue-api.ts";
import { createDefaultFilterState } from "../lib/filter-state.ts";

test("browser search sends the complete filter state only to the same-origin BFF", async () => {
  const fetchImplementation: typeof fetch = async (input) => {
    assert.equal(
      input.toString(),
      "/api/catalogue/skins?sort=rarity_desc&search=redline&category=rifles&weapon=AK-47&stattrak=false&limit=25&offset=50",
    );
    return new Response(JSON.stringify({ items: [], total: 1475 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  const api = new CatalogueApi(fetchImplementation);
  const state = {
    ...createDefaultFilterState(),
    sort: "rarity_desc" as const,
    search: "redline",
    categories: ["rifles" as const],
    weapons: ["AK-47"],
    stattrak: false,
    offset: 50,
  };

  assert.deepEqual(await api.search(state, new AbortController().signal), {
    items: [], total: 1475,
  });
});

test("browser options load through the same-origin filters route", async () => {
  const fetchImplementation: typeof fetch = async (input) => {
    assert.equal(input.toString(), "/api/catalogue/skins/filters");
    return new Response(JSON.stringify({
      weapons: [],
      weaponCategories: [
        { id: "rifles", name: "Rifles", weapons: [] },
        { id: "pistols", name: "Pistols", weapons: [] },
        { id: "smgs", name: "SMGs", weapons: [] },
        { id: "heavy", name: "Heavy", weapons: [] },
        { id: "knives", name: "Knives", weapons: [] },
        { id: "gloves", name: "Gloves", weapons: [] },
        { id: "equipment", name: "Equipment", weapons: [] },
      ],
      collections: [], cases: [], sourceTypes: [], rarities: [], wears: [],
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  const api = new CatalogueApi(fetchImplementation);
  assert.deepEqual(await api.loadOptions(new AbortController().signal), {
    weapons: [],
    weaponCategories: [
      { id: "rifles", name: "Rifles", weapons: [] },
      { id: "pistols", name: "Pistols", weapons: [] },
      { id: "smgs", name: "SMGs", weapons: [] },
      { id: "heavy", name: "Heavy", weapons: [] },
      { id: "knives", name: "Knives", weapons: [] },
      { id: "gloves", name: "Gloves", weapons: [] },
      { id: "equipment", name: "Equipment", weapons: [] },
    ],
    collections: [], cases: [], sourceTypes: [], rarities: [], wears: [],
  });
});

test("browser API failures expose one safe message", async () => {
  const api = new CatalogueApi(async () => new Response(
    JSON.stringify({ error: { message: "internal database host" } }),
    { status: 500, headers: { "Content-Type": "application/json" } },
  ));
  await assert.rejects(
    api.search(createDefaultFilterState(), new AbortController().signal),
    (error) => error instanceof Error
      && error.message === "The skin database is temporarily unavailable.",
  );
});

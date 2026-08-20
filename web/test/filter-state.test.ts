import assert from "node:assert/strict";
import test from "node:test";

import {
  clearFilters,
  createDefaultFilterState,
  parseFilterState,
  removeFilter,
  serialiseFilterState,
  type FilterState,
} from "../lib/filter-state.ts";

test("filter state survives a readable URL round trip", () => {
  const state = {
    sort: "rarity_desc",
    search: "red line",
    weapons: ["AK-47", "AWP"],
    collections: ["the_falchion_collection"],
    cases: [],
    sourceTypes: ["souvenir_package"],
    rarities: ["Covert"],
    wears: ["Factory New"],
    stattrak: true,
    souvenir: false,
    floatMin: 0,
    floatMax: 0.07,
    limit: 25,
    offset: 0,
  } satisfies FilterState;
  const params = serialiseFilterState(state, new URLSearchParams("ref=nav"));

  assert.equal(params.get("ref"), "nav");
  assert.equal(params.get("weapon"), "AK-47,AWP");
  assert.equal(params.get("sort"), "rarity_desc");
  assert.deepEqual(parseFilterState(params), state);
});

test("invalid URL values fall back safely", () => {
  const state = parseFilterState(new URLSearchParams(
    "sort=price_desc&float_min=-1&float_max=later&limit=500&offset=-4&stattrak=yes",
  ));
  assert.deepEqual(state, createDefaultFilterState());
});

test("reversed float bounds are removed together", () => {
  const state = parseFilterState(new URLSearchParams("float_min=0.8&float_max=0.2"));
  assert.equal(state.floatMin, null);
  assert.equal(state.floatMax, null);
});

test("removing values resets pagination and clear preserves sort", () => {
  const state = {
    ...createDefaultFilterState(),
    sort: "name_asc",
    weapons: ["AK-47", "AWP"],
    offset: 50,
  } satisfies FilterState;
  assert.deepEqual(removeFilter(state, "weapons", "AK-47"), {
    ...state,
    weapons: ["AWP"],
    offset: 0,
  });
  assert.deepEqual(clearFilters(state), {
    ...createDefaultFilterState(),
    sort: "name_asc",
  });
});

test("serialization removes owned defaults and retains unrelated parameters", () => {
  const params = serialiseFilterState(
    createDefaultFilterState(),
    new URLSearchParams("campaign=summer&weapon=AK-47&offset=25"),
  );
  assert.equal(params.toString(), "campaign=summer");
});

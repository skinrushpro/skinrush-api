import assert from "node:assert/strict";
import test from "node:test";

import {
  CatalogueError,
  buildUpstreamUrl,
  createCatalogueResponse,
  fetchCatalogue,
} from "../lib/catalogue.ts";
import { parseCataloguePage } from "../lib/catalogue-contract.ts";

const API_ORIGIN = "https://skinrush-api.example";

test("the upstream URL has a fixed destination and only forwards approved parameters", () => {
  const input = new URLSearchParams({
    search: "redline",
    weapon: "AK-47",
    limit: "10",
    offset: "20",
  });

  const url = buildUpstreamUrl(input, API_ORIGIN);

  assert.equal(
    url.toString(),
    "https://skinrush-api.example/api/skins?search=redline&weapon=AK-47&limit=10&offset=20",
  );
});

test("the upstream URL supplies bounded pagination defaults", () => {
  assert.equal(
    buildUpstreamUrl(new URLSearchParams(), API_ORIGIN).toString(),
    "https://skinrush-api.example/api/skins?limit=25",
  );
});

for (const [query, field] of [
  ["destination=https://attacker.example", "destination"],
  ["limit=0", "limit"],
  ["limit=101", "limit"],
  ["limit=2.5", "limit"],
  ["offset=-1", "offset"],
  ["offset=next", "offset"],
] as const) {
  test(`the BFF rejects unsafe or invalid ${field} input`, () => {
    assert.throws(
      () => buildUpstreamUrl(new URLSearchParams(query), API_ORIGIN),
      (error) => error instanceof CatalogueError
        && error.status === 400
        && error.code === "INVALID_QUERY",
    );
  });
}

test("catalogue responses expose only the current public DTO and preserve total count", async () => {
  const upstreamRecord = {
    id: "skin-1",
    name: "AK-47 | Redline",
    weapon: "AK-47",
    rarity: "Classified",
    rarityColor: "#d32ce6",
    category: "Rifles",
    min_float: 0.1,
    max_float: 0.7,
    stattrak: true,
    souvenir: false,
    image: "https://cdn.example/redline.png",
    phase: null,
    description: "Not needed in Part 2.",
    collections: [{ id: "phoenix", name: "The Phoenix Collection" }],
    cases: [{ id: "phoenix-case", name: "Phoenix Case", sourceType: "case" }],
    availableWears: ["Minimal Wear"],
  };
  const fetchImplementation: typeof fetch = async () => new Response(
    JSON.stringify([upstreamRecord]),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-Total-Count": "1842",
      },
    },
  );

  const result = await fetchCatalogue(new URLSearchParams("limit=1"), {
    apiBaseUrl: API_ORIGIN,
    fetchImplementation,
  });

  assert.deepEqual(result, {
    items: [{
      id: "skin-1",
      name: "AK-47 | Redline",
      weapon: "AK-47",
      rarity: "Classified",
    }],
    total: 1842,
  });
});

test("upstream failures become a safe catalogue error", async () => {
  const fetchImplementation: typeof fetch = async () => new Response(
    JSON.stringify({ error: "database table skins_internal failed" }),
    { status: 500, headers: { "Content-Type": "application/json" } },
  );

  await assert.rejects(
    fetchCatalogue(new URLSearchParams(), {
      apiBaseUrl: API_ORIGIN,
      fetchImplementation,
    }),
    (error) => error instanceof CatalogueError
      && error.status === 502
      && error.code === "CATALOGUE_UNAVAILABLE"
      && !error.message.includes("skins_internal"),
  );
});

test("malformed upstream catalogue data fails closed", async () => {
  const fetchImplementation: typeof fetch = async () => new Response(
    JSON.stringify([{ id: "skin-1", name: "Missing weapon" }]),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-Total-Count": "1",
      },
    },
  );

  await assert.rejects(
    fetchCatalogue(new URLSearchParams(), {
      apiBaseUrl: API_ORIGIN,
      fetchImplementation,
    }),
    (error) => error instanceof CatalogueError
      && error.status === 502
      && error.code === "INVALID_UPSTREAM_RESPONSE",
  );
});

test("the BFF response returns the public envelope and total header", async () => {
  const fetchImplementation: typeof fetch = async () => new Response(
    JSON.stringify([{
      id: "skin-2",
      name: "AWP | Asiimov",
      weapon: "AWP",
      rarity: "Covert",
    }]),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-Total-Count": "42",
      },
    },
  );

  const response = await createCatalogueResponse(
    new Request("https://skinrush.pro/api/catalogue/skins?limit=1"),
    { apiBaseUrl: API_ORIGIN, fetchImplementation },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("X-Total-Count"), "42");
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.deepEqual(await response.json(), {
    items: [{ id: "skin-2", name: "AWP | Asiimov", weapon: "AWP", rarity: "Covert" }],
    total: 42,
  });
});

test("the BFF response exposes safe errors without upstream details", async () => {
  const fetchImplementation: typeof fetch = async () => new Response(
    JSON.stringify({ stack: "database password appeared here" }),
    { status: 500, headers: { "Content-Type": "application/json" } },
  );

  const response = await createCatalogueResponse(
    new Request("https://skinrush.pro/api/catalogue/skins"),
    { apiBaseUrl: API_ORIGIN, fetchImplementation },
  );

  assert.equal(response.status, 502);
  assert.deepEqual(await response.json(), {
    error: {
      code: "CATALOGUE_UNAVAILABLE",
      message: "The skin catalogue is temporarily unavailable.",
    },
  });
});

test("the browser contract accepts only a complete minimal catalogue page", () => {
  assert.deepEqual(parseCataloguePage({
    items: [{ id: "skin-3", name: "M4A4 | Neo-Noir", weapon: "M4A4", rarity: null }],
    total: 1,
  }), {
    items: [{ id: "skin-3", name: "M4A4 | Neo-Noir", weapon: "M4A4", rarity: null }],
    total: 1,
  });
  assert.equal(parseCataloguePage({
    items: [{ id: "skin-3", name: "Missing weapon", rarity: null }],
    total: 1,
  }), null);
});

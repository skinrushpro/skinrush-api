import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { SkinCard, type SkinCardClassNames } from "../components/SkinCard.ts";
import type { PublicSkin } from "../lib/catalogue-contract.ts";

const classNames: SkinCardClassNames = {
  artwork: "artwork",
  imageStage: "image-stage",
  rarity: "rarity",
  result: "result",
  weapon: "weapon",
};

const skin: PublicSkin = {
  id: "skin-1",
  name: "Redline",
  weapon: "AK-47",
  rarity: "Classified",
  image: null,
};

test("a null image preserves the card stage without rendering an image element", () => {
  const html = renderToStaticMarkup(SkinCard({ skin, classNames }));

  assert.match(html, /class="image-stage"/);
  assert.doesNotMatch(html, /<img\b/);
  assert.ok(html.indexOf("AK-47") < html.indexOf("Redline"));
  assert.ok(html.indexOf("Redline") < html.indexOf("Classified"));
});

test("an available image renders the complete authored canvas contract", () => {
  const html = renderToStaticMarkup(SkinCard({
    skin: { ...skin, image: "https://cdn.example/redline.png" },
    classNames,
  }));

  assert.match(html, /<img\b/);
  assert.match(html, /src="https:\/\/cdn\.example\/redline\.png"/);
  assert.match(html, /width="1024"/);
  assert.match(html, /height="600"/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /decoding="async"/);
});

test("image and null cards share one reserved stage geometry on desktop and tablet", async () => {
  const css = await readFile(new URL("../components/SkinsCatalogue.module.css", import.meta.url), "utf8");

  assert.match(css, /\.results\s*\{[^}]*repeat\(auto-fit,\s*minmax\(15\.25rem,\s*1fr\)\)[^}]*gap:\s*\.75rem/);
  assert.match(css, /\.result\s*\{[^}]*isolation:\s*isolate[^}]*overflow:\s*clip/);
  assert.match(css, /\.imageStage\s*\{[^}]*aspect-ratio:\s*1024\s*\/\s*600[^}]*overflow:\s*visible/);
  assert.match(css, /\.artwork\s*\{[^}]*width:\s*100%[^}]*height:\s*100%[^}]*object-fit:\s*contain/);
  assert.doesNotMatch(css, /object-fit:\s*cover/i);
  assert.doesNotMatch(css, /\.artwork\s*\{[^}]*transform\s*:/);
  assert.doesNotMatch(css, /@media\s*\([^)]*max-width/i);
});

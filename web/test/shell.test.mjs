import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const readProjectFile = (path) =>
  readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the permanent shell navigation includes both public routes", async () => {
  const header = await readProjectFile("components/SiteHeader.tsx");

  assert.match(header, /href: ["']\/["']/);
  assert.match(header, /href: ["']\/skins["']/);
});

test("both Part 1 App Router pages exist with permanent copy", async () => {
  const [home, skins] = await Promise.all([
    readProjectFile("app/page.tsx"),
    readProjectFile("app/skins/page.tsx"),
  ]);

  assert.match(home, /SkinRush/);
  assert.match(skins, /Skin Database/);
});

test("the confirmed SkinRush palette is defined as reusable CSS variables", async () => {
  const styles = await readProjectFile("styles/globals.css");

  for (const colour of ["#0A0014", "#382051", "#2D1A38", "#00F0FF"]) {
    assert.match(styles, new RegExp(colour, "i"));
  }
});

import { createElement, type ReactElement } from "react";

import type { PublicSkin } from "../lib/catalogue-contract.ts";

export interface SkinCardClassNames {
  artwork: string;
  imageStage: string;
  rarity: string;
  result: string;
  weapon: string;
}

interface SkinCardProps {
  skin: PublicSkin;
  classNames: SkinCardClassNames;
}

export function SkinCard({ skin, classNames }: SkinCardProps): ReactElement {
  const artwork = skin.image !== null
    ? createElement("img", {
        alt: `${skin.weapon}: ${skin.name}`,
        className: classNames.artwork,
        decoding: "async",
        height: 600,
        loading: "lazy",
        src: skin.image,
        width: 1024,
      })
    : null;

  return createElement(
    "li",
    { className: classNames.result },
    createElement("span", { className: classNames.imageStage }, artwork),
    createElement("span", { className: classNames.weapon }, skin.weapon),
    createElement("strong", null, skin.name),
    createElement("span", { className: classNames.rarity }, skin.rarity ?? "Unclassified"),
  );
}

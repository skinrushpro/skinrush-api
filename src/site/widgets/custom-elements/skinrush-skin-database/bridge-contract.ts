import type { ControllerSnapshot } from './controller';
import type { SkinResult } from './types';

export const SKINRUSH_RESULTS_EVENT = 'skinrush-results-change';
export const SKINRUSH_COMMAND_ATTRIBUTE = 'skinrush-command';

export type SourceKind = 'case' | 'collection';

export interface BridgeSourceAction {
  kind: SourceKind;
  id: string;
}

export interface BridgeSourcePresentation {
  text: string;
  action: BridgeSourceAction | null;
  linkedNames: string[];
}

export interface BridgeSkinItem {
  _id: string;
  skinId: string;
  title: string;
  rarityColor: string | null;
  stattrak: boolean;
  souvenir: boolean;
  wearSpan: string;
  floatMin: number;
  floatMax: number;
  floatRange: string;
  artworkUrl: string | null;
  source: BridgeSourcePresentation;
}

export interface ResultsBridgePayload {
  version: 1;
  revision: number;
  items: BridgeSkinItem[];
  total: number;
  loading: boolean;
  error: string | null;
  selectedSkinId: string | null;
}

export type SkinrushCommand =
  | { type: 'select-skin'; skinId: string; revision: number }
  | {
    type: 'apply-source-filter';
    sourceKind: SourceKind;
    sourceId: string;
    revision: number;
  };

interface CommandController {
  select(skinId: string): void;
  applySourceFilter(kind: SourceKind, sourceId: string): void;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isRevision(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function title(skin: SkinResult): string {
  return skin.name.toLocaleLowerCase().startsWith(`${skin.weapon} |`.toLocaleLowerCase())
    ? skin.name
    : `${skin.weapon} | ${skin.name}`;
}

function sourcePresentation(skin: SkinResult): BridgeSourcePresentation {
  if (skin.cases.length === 1) {
    const source = skin.cases[0];
    return {
      text: source.name,
      action: { kind: 'case', id: source.id },
      linkedNames: [source.name],
    };
  }
  if (skin.cases.length > 1) {
    return {
      text: 'Multiple sources',
      action: null,
      linkedNames: skin.cases.map(source => source.name),
    };
  }
  if (skin.collections.length === 1) {
    const source = skin.collections[0];
    return {
      text: source.name,
      action: { kind: 'collection', id: source.id },
      linkedNames: [source.name],
    };
  }
  if (skin.collections.length > 1) {
    return {
      text: 'Multiple collections',
      action: null,
      linkedNames: skin.collections.map(source => source.name),
    };
  }
  return { text: 'Source unavailable', action: null, linkedNames: [] };
}

function wearSpan(skin: SkinResult): string {
  const first = skin.availableWears[0];
  const last = skin.availableWears.at(-1);
  if (!first || !last) return 'Wear unavailable';
  return first === last ? first : `${first} → ${last}`;
}

function floatValue(value: number): string {
  return value.toFixed(2);
}

export function skinIdToRepeaterId(skinId: string): string {
  const encoded = [...skinId]
    .map(character => character.codePointAt(0)?.toString(16).padStart(6, '0') ?? '')
    .join('');
  return `skin-${encoded}`;
}

function bridgeItem(skin: SkinResult): BridgeSkinItem {
  const artworkUrl = skin.image?.trim() || null;
  return {
    _id: skinIdToRepeaterId(skin.id),
    skinId: skin.id,
    title: title(skin),
    rarityColor: skin.rarityColor,
    stattrak: skin.stattrak,
    souvenir: skin.souvenir,
    wearSpan: wearSpan(skin),
    floatMin: skin.min_float,
    floatMax: skin.max_float,
    floatRange: `${floatValue(skin.min_float)}–${floatValue(skin.max_float)}`,
    artworkUrl,
    source: sourcePresentation(skin),
  };
}

export function createResultsBridgePayload(
  snapshot: ControllerSnapshot,
  revision: number,
): ResultsBridgePayload {
  return {
    version: 1,
    revision,
    items: snapshot.items.map(bridgeItem),
    total: snapshot.total,
    loading: snapshot.loading,
    error: snapshot.error,
    selectedSkinId: snapshot.selectedId,
  };
}

export function createResultsBridgeEvent(
  payload: ResultsBridgePayload,
): CustomEvent<ResultsBridgePayload> {
  return new CustomEvent(SKINRUSH_RESULTS_EVENT, {
    detail: payload,
    bubbles: true,
    composed: true,
  });
}

export function dispatchResultsBridgeEvent(
  root: HTMLElement,
  payload: ResultsBridgePayload,
): void {
  const rootNode = root.getRootNode();
  const target = typeof ShadowRoot !== 'undefined' && rootNode instanceof ShadowRoot
    ? rootNode.host
    : root;
  target.dispatchEvent(createResultsBridgeEvent(payload));
}

function isSourceAction(value: unknown): value is BridgeSourceAction {
  return isRecord(value)
    && (value.kind === 'case' || value.kind === 'collection')
    && isNonEmptyString(value.id);
}

function isSource(value: unknown): value is BridgeSourcePresentation {
  return isRecord(value)
    && isNonEmptyString(value.text)
    && (value.action === null || isSourceAction(value.action))
    && Array.isArray(value.linkedNames)
    && value.linkedNames.every(isNonEmptyString);
}

function isBridgeItem(value: unknown): value is BridgeSkinItem {
  return isRecord(value)
    && isNonEmptyString(value._id)
    && /^[A-Za-z0-9-]+$/.test(value._id)
    && isNonEmptyString(value.skinId)
    && isNonEmptyString(value.title)
    && (value.rarityColor === null || typeof value.rarityColor === 'string')
    && typeof value.stattrak === 'boolean'
    && typeof value.souvenir === 'boolean'
    && isNonEmptyString(value.wearSpan)
    && typeof value.floatMin === 'number'
    && Number.isFinite(value.floatMin)
    && typeof value.floatMax === 'number'
    && Number.isFinite(value.floatMax)
    && isNonEmptyString(value.floatRange)
    && (value.artworkUrl === null || isNonEmptyString(value.artworkUrl))
    && isSource(value.source);
}

export function parseResultsBridgePayload(value: unknown): ResultsBridgePayload | null {
  if (!isRecord(value)
    || value.version !== 1
    || !isRevision(value.revision)
    || !Array.isArray(value.items)
    || !value.items.every(isBridgeItem)
    || !Number.isSafeInteger(value.total)
    || Number(value.total) < 0
    || typeof value.loading !== 'boolean'
    || !(value.error === null || typeof value.error === 'string')
    || !(value.selectedSkinId === null || isNonEmptyString(value.selectedSkinId))) {
    return null;
  }
  const identifiers = value.items.map(item => item._id);
  if (new Set(identifiers).size !== identifiers.length) return null;
  return value as unknown as ResultsBridgePayload;
}

export function parseSkinrushCommand(serialised: string | null): SkinrushCommand | null {
  if (!serialised) return null;
  let value: unknown;
  try {
    value = JSON.parse(serialised);
  } catch {
    return null;
  }
  if (!isRecord(value) || !isRevision(value.revision)) return null;
  if (value.type === 'select-skin' && isNonEmptyString(value.skinId)) {
    return { type: value.type, skinId: value.skinId, revision: value.revision };
  }
  if (value.type === 'apply-source-filter'
    && (value.sourceKind === 'case' || value.sourceKind === 'collection')
    && isNonEmptyString(value.sourceId)) {
    return {
      type: value.type,
      sourceKind: value.sourceKind,
      sourceId: value.sourceId,
      revision: value.revision,
    };
  }
  return null;
}

export function dispatchSkinrushCommand(
  controller: CommandController,
  serialised: string | null,
  latestRevision: number,
): number {
  const command = parseSkinrushCommand(serialised);
  if (!command || command.revision <= latestRevision) return latestRevision;
  if (command.type === 'select-skin') {
    controller.select(command.skinId);
  } else {
    controller.applySourceFilter(command.sourceKind, command.sourceId);
  }
  return command.revision;
}

/**
 * Source-of-record copy of the Wix Skin Database Page Code adapter.
 *
 * Wix executes the corresponding code stored on the Skin Database page.
 * Keep both copies in sync manually until the Wix site itself is connected to Git.
 * This adapter intentionally contains no API, filtering, sorting, pagination,
 * URL/history, wear, float, or source-selection business logic.
 */

const CUSTOM_ELEMENT_ID = '#skinRushSkinDatabase1';
const REPEATER_ID = '#skinDatabaseCardsRepeater';
const RESULTS_EVENT = 'skinrush-results-change';
const COMMAND_ATTRIBUTE = 'skinrush-command';

let commandRevision = 0;
let selectedSkinId = null;
let suppressedCardSelection = null;
const currentItems = new Map();

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isSourceAction(value) {
  return value !== null
    && typeof value === 'object'
    && (value.kind === 'case' || value.kind === 'collection')
    && isNonEmptyString(value.id);
}

function isSource(value) {
  return value !== null
    && typeof value === 'object'
    && isNonEmptyString(value.text)
    && (value.action === null || isSourceAction(value.action))
    && Array.isArray(value.linkedNames)
    && value.linkedNames.every(isNonEmptyString);
}

function isBridgeItem(value) {
  return value !== null
    && typeof value === 'object'
    && isNonEmptyString(value._id)
    && /^[A-Za-z0-9-]+$/.test(value._id)
    && isNonEmptyString(value.skinId)
    && isNonEmptyString(value.title)
    && typeof value.stattrak === 'boolean'
    && typeof value.souvenir === 'boolean'
    && isNonEmptyString(value.wearSpan)
    && isNonEmptyString(value.floatRange)
    && Number.isFinite(value.floatMin)
    && Number.isFinite(value.floatMax)
    && (value.artworkUrl === null || isNonEmptyString(value.artworkUrl))
    && isSource(value.source);
}

function parsePayload(value) {
  if (value === null
    || typeof value !== 'object'
    || value.version !== 1
    || !Number.isSafeInteger(value.revision)
    || value.revision < 0
    || !Array.isArray(value.items)
    || !value.items.every(isBridgeItem)
    || !Number.isSafeInteger(value.total)
    || value.total < 0
    || typeof value.loading !== 'boolean'
    || !(value.error === null || typeof value.error === 'string')
    || !(value.selectedSkinId === null || isNonEmptyString(value.selectedSkinId))) {
    return null;
  }
  const ids = value.items.map(item => item._id);
  return new Set(ids).size === ids.length ? value : null;
}

function sendCommand(command) {
  commandRevision += 1;
  $w(CUSTOM_ELEMENT_ID).setAttribute(COMMAND_ATTRIBUTE, JSON.stringify({
    ...command,
    revision: commandRevision,
  }));
}

function setCollapsed(element, collapsed) {
  if (collapsed) element.collapse();
  else element.expand();
}

function bindCard($item, itemData) {
  $item('#weaponNameTitle').text = itemData.title;
  $item('#rarityRange').text = itemData.wearSpan;
  $item('#floatNumber').text = itemData.floatRange;
  $item('#caseName').text = itemData.source.text;

  setCollapsed($item('#armouryIcon'), true);
  setCollapsed($item('#tradeUpSignalIcon'), true);
  setCollapsed($item('#stattrakIcon'), !itemData.stattrak);
  setCollapsed($item('#souvenirIcon'), !itemData.souvenir);
  setCollapsed($item('#marketPriceStack'), true);

  if (itemData.artworkUrl) {
    $item('#weaponImage').src = itemData.artworkUrl;
    $item('#weaponImage').alt = itemData.title;
    $item('#weaponImage').expand();
  } else {
    $item('#weaponImage').collapse();
  }

  const card = $item('#mainCardContainer');
  if (card.accessibility) {
    card.accessibility.ariaLabel = itemData.title;
    card.accessibility.ariaPressed = itemData.skinId === selectedSkinId;
  }

  const sourcePlate = $item('#caseNameContainer');
  if (sourcePlate.accessibility) {
    sourcePlate.accessibility.ariaLabel = itemData.source.linkedNames.join(', ') || itemData.source.text;
  }
}

function attachCardHandlers($item, repeaterId) {
  $item('#mainCardContainer').onClick(() => {
    const itemData = currentItems.get(repeaterId);
    if (!itemData) return;
    if (suppressedCardSelection === itemData.skinId) return;
    sendCommand({ type: 'select-skin', skinId: itemData.skinId });
  });
  $item('#caseNameContainer').onClick(() => {
    const itemData = currentItems.get(repeaterId);
    if (!itemData?.source.action) return;
    suppressedCardSelection = itemData.skinId;
    setTimeout(() => {
      if (suppressedCardSelection === itemData.skinId) suppressedCardSelection = null;
    }, 0);
    sendCommand({
      type: 'apply-source-filter',
      sourceKind: itemData.source.action.kind,
      sourceId: itemData.source.action.id,
    });
  });
}

function applyPayload(payload) {
  selectedSkinId = payload.selectedSkinId;
  currentItems.clear();
  payload.items.forEach(item => currentItems.set(item._id, item));
  const repeater = $w(REPEATER_ID);
  repeater.data = payload.items;
  repeater.forEachItem(($item, itemData) => bindCard($item, itemData));
}

$w.onReady(() => {
  const repeater = $w(REPEATER_ID);
  repeater.onItemReady(($item, itemData) => {
    attachCardHandlers($item, itemData._id);
    bindCard($item, itemData);
  });
  $w(CUSTOM_ELEMENT_ID).on(RESULTS_EVENT, event => {
    const payload = parsePayload(event.detail);
    if (payload) applyPayload(payload);
  });
});

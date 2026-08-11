import type { FilterState, SkinResult } from './types';
import { WEAR_ABBREVIATIONS } from './wear';
import { escapeHtml } from './render-filters';

interface ResultsModel {
  items: SkinResult[];
  total: number;
  state: FilterState;
  selectedId: string | null;
  loading: boolean;
  error: string | null;
}

function safeRarityColor(value: string | null): string {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : '#00F0FF';
}

function contextLine(skin: SkinResult): string {
  const source = skin.cases[0]?.name ?? skin.collections[0]?.name;
  return source ? escapeHtml(source) : 'Source unlisted';
}

function skinImage(skin: SkinResult): string {
  const image = skin.image?.trim();
  if (image) {
    return `<img class="sr-skin-image" src="${escapeHtml(image)}" alt="${escapeHtml(`${skin.weapon} | ${skin.name}`)}" loading="lazy">`;
  }
  return `
    <div class="sr-image-fallback" role="img" aria-label="Image unavailable for ${escapeHtml(`${skin.weapon} | ${skin.name}`)}">
      <span class="sr-fallback-mark">SR</span>
      <span>SkinRush</span>
    </div>`;
}

function card(skin: SkinResult, selected: boolean): string {
  const wears = skin.availableWears
    .map(wear => `<span class="sr-wear-chip" title="${escapeHtml(wear)}">${escapeHtml(WEAR_ABBREVIATIONS[wear] ?? wear)}</span>`)
    .join('');
  const attributes = selected ? ' aria-expanded="true"' : ' aria-expanded="false"';

  return `
    <article class="sr-card" style="--sr-rarity:${safeRarityColor(skin.rarityColor)}">
      <button type="button" class="sr-card-button" data-action="select-skin" data-skin-id="${escapeHtml(skin.id)}"${attributes}>
        <span class="sr-card-title">${escapeHtml(skin.weapon)} <span aria-hidden="true">|</span> ${escapeHtml(skin.name)}</span>
        <span class="sr-card-meta">
          <span class="sr-rarity-dot" aria-hidden="true"></span>
          <span>${escapeHtml(skin.rarity ?? 'Rarity unlisted')}</span>
          ${skin.stattrak ? '<span class="sr-flag">StatTrak™</span>' : ''}
          ${skin.souvenir ? '<span class="sr-flag">Souvenir</span>' : ''}
        </span>
        <span class="sr-wear-row" aria-label="Available qualities">${wears || '<span class="sr-muted">Wear unlisted</span>'}</span>
        <span class="sr-context">${contextLine(skin)}</span>
        <span class="sr-artwork">${skinImage(skin)}</span>
        <span class="sr-collection-context">${escapeHtml(skin.collections[0]?.name ?? 'Collection unlisted')}</span>
      </button>
    </article>`;
}

function expandedPanel(skin: SkinResult): string {
  const floatRange = `${skin.min_float.toFixed(2)}–${skin.max_float.toFixed(2)}`;
  return `
    <section class="sr-expanded-panel" data-expanded-for="${escapeHtml(skin.id)}" aria-label="${escapeHtml(`${skin.weapon} | ${skin.name} details`)}">
      <div>
        <p class="sr-eyebrow">SELECTED SKIN</p>
        <h3>${escapeHtml(skin.weapon)} <span aria-hidden="true">|</span> ${escapeHtml(skin.name)}</h3>
        ${skin.description ? `<p>${escapeHtml(skin.description)}</p>` : ''}
      </div>
      <dl class="sr-detail-list">
        <div><dt>Float range</dt><dd>${floatRange}</dd></div>
        <div><dt>Category</dt><dd>${escapeHtml(skin.category ?? 'Unlisted')}</dd></div>
        <div><dt>Rarity</dt><dd>${escapeHtml(skin.rarity ?? 'Unlisted')}</dd></div>
        ${skin.phase ? `<div><dt>Phase</dt><dd>${escapeHtml(skin.phase)}</dd></div>` : ''}
        <div><dt>Collection</dt><dd>${escapeHtml(skin.collections.map(item => item.name).join(', ') || 'Unlisted')}</dd></div>
        <div><dt>Source</dt><dd>${escapeHtml(skin.cases.map(item => item.name).join(', ') || 'Unlisted')}</dd></div>
      </dl>
    </section>`;
}

function breadcrumb(state: FilterState): string {
  if (state.collections.length === 1) return 'Collection &gt; Skins';
  return state.collections.length > 1 ? 'Filtered skins' : 'Collection &gt; Skins';
}

export function renderResults(model: ResultsModel): string {
  const selected = model.items.find(item => item.id === model.selectedId) ?? null;
  const cards = model.items.map(item => (
    card(item, item.id === model.selectedId)
    + (item.id === model.selectedId ? expandedPanel(item) : '')
  )).join('');

  const status = model.loading
    ? '<p class="sr-update-status" role="status" aria-live="polite">Updating skins…</p>'
    : '';
  const error = model.error
    ? `<section class="sr-state-card" role="alert"><h3>We couldn’t load the skin database</h3><p>${escapeHtml(model.error)}</p><button type="button" data-action="retry">Try again</button></section>`
    : '';
  const empty = !model.loading && !model.error && model.items.length === 0
    ? '<section class="sr-state-card"><h3>No skins match these filters</h3><p>Remove a filter or clear the current search to see more skins.</p><button type="button" data-action="clear-filters">Clear filters</button></section>'
    : '';

  return `
    <section class="sr-results" aria-labelledby="sr-results-heading">
      <div class="sr-results-heading">
        <div><p class="sr-breadcrumb">${breadcrumb(model.state)}</p><h2 id="sr-results-heading">Skin database</h2></div>
        <p><strong>${model.total.toLocaleString('en-GB')}</strong> ${model.total === 1 ? 'skin' : 'skins'}</p>
      </div>
      ${status}
      ${error || empty || `<div class="sr-card-grid" aria-busy="${model.loading}">${cards}</div>`}
      ${selected ? '<span class="sr-visually-hidden" aria-live="polite">Skin details opened</span>' : ''}
    </section>`;
}

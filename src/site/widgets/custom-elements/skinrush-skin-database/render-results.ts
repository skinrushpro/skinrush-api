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
  detailAfterIndex?: number | null;
}

function safeRarityColor(value: string | null): string {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : '#00F0FF';
}

function contextLine(skin: SkinResult): string {
  const source = skin.cases[0]?.name ?? skin.collections[0]?.name;
  return source ? escapeHtml(source) : 'Source unlisted';
}

function skinTitle(skin: SkinResult): string {
  return skin.name.toLocaleLowerCase().startsWith(`${skin.weapon} |`.toLocaleLowerCase())
    ? skin.name
    : `${skin.weapon} | ${skin.name}`;
}

function skinImage(skin: SkinResult): string {
  const image = skin.image?.trim();
  if (image) {
    return `<img class="sr-skin-image" src="${escapeHtml(image)}" alt="${escapeHtml(skinTitle(skin))}" loading="lazy">`;
  }
  return `
    <div class="sr-image-fallback" role="img" aria-label="Image unavailable for ${escapeHtml(skinTitle(skin))}">
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
        <span class="sr-card-title">${escapeHtml(skinTitle(skin))}</span>
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
    <section class="sr-expanded-panel" data-expanded-for="${escapeHtml(skin.id)}" aria-label="${escapeHtml(`${skinTitle(skin)} details`)}">
      <div>
        <p class="sr-eyebrow">SELECTED SKIN</p>
        <h3>${escapeHtml(skinTitle(skin))}</h3>
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

function pagination(state: FilterState, total: number): string {
  if (total <= state.limit) return '';
  const pageCount = Math.ceil(total / state.limit);
  const currentPage = Math.floor(state.offset / state.limit) + 1;
  const previousOffset = Math.max(0, state.offset - state.limit);
  const nextOffset = Math.min((pageCount - 1) * state.limit, state.offset + state.limit);
  return `
    <nav class="sr-pagination" aria-label="Skin database pages">
      <button type="button" data-action="previous-page" data-offset="${previousOffset}"${currentPage === 1 ? ' disabled' : ''}>Previous</button>
      <span>Page ${currentPage} of ${pageCount}</span>
      <button type="button" data-action="next-page" data-offset="${nextOffset}"${currentPage === pageCount ? ' disabled' : ''}>Next</button>
    </nav>`;
}

export function renderResults(model: ResultsModel): string {
  const selected = model.items.find(item => item.id === model.selectedId) ?? null;
  const fallbackIndex = selected
    ? model.items.findIndex(item => item.id === selected.id)
    : -1;
  const detailAfterIndex = model.detailAfterIndex ?? fallbackIndex;
  const cards = model.items.map((item, index) => (
    card(item, item.id === model.selectedId)
    + (selected && index === detailAfterIndex ? expandedPanel(selected) : '')
  )).join('');

  const status = model.loading
    ? '<p class="sr-update-status" role="status" aria-live="polite">Updating skins…</p>'
    : '';
  const error = model.error
    ? `<section class="sr-state-card${model.items.length ? ' sr-state-card--inline' : ''}" role="alert"><h3>We couldn’t load the skin database</h3><p>${escapeHtml(model.error)}</p><button type="button" data-action="retry">Try again</button></section>`
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
      ${error}
      ${empty || (model.items.length ? `<div class="sr-card-grid" aria-busy="${model.loading}">${cards}</div>` : '')}
      ${!model.error && model.items.length ? pagination(model.state, model.total) : ''}
      ${selected ? '<span class="sr-visually-hidden" aria-live="polite">Skin details opened</span>' : ''}
    </section>`;
}

import type { FilterOptions, FilterState } from './types';

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function optionList(
  values: readonly { value: string; label: string }[],
): string {
  return values.map(({ value, label }) => (
    `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`
  )).join('');
}

function multiSelect(
  name: string,
  label: string,
  values: readonly { value: string; label: string }[],
  _active: readonly string[],
): string {
  return `
    <label class="sr-field sr-field--select">
      <span>${escapeHtml(label)}</span>
      <select name="${escapeHtml(name)}" aria-label="${escapeHtml(label)}">
        <option value="">Any ${escapeHtml(label.toLowerCase())}</option>
        ${optionList(values)}
      </select>
    </label>`;
}

function triState(
  name: string,
  label: string,
  value: boolean | null,
): string {
  return `
    <label class="sr-field sr-field--compact">
      <span>${escapeHtml(label)}</span>
      <select name="${escapeHtml(name)}">
        <option value=""${value === null ? ' selected' : ''}>Any</option>
        <option value="true"${value === true ? ' selected' : ''}>Available</option>
        <option value="false"${value === false ? ' selected' : ''}>Not available</option>
      </select>
    </label>`;
}

interface ActiveFilter {
  key: string;
  value?: string;
  label: string;
}

function activeFilters(state: FilterState, options: FilterOptions): ActiveFilter[] {
  const collectionNames = new Map(options.collections.map(item => [item.id, item.name]));
  const caseNames = new Map(options.cases.map(item => [item.id, item.name]));
  const items: ActiveFilter[] = [];

  if (state.search) items.push({ key: 'search', label: `Search: ${state.search}` });
  for (const value of state.weapons) items.push({ key: 'weapons', value, label: value });
  for (const value of state.collections) {
    items.push({ key: 'collections', value, label: collectionNames.get(value) ?? value });
  }
  for (const value of state.cases) {
    items.push({ key: 'cases', value, label: caseNames.get(value) ?? value });
  }
  for (const value of state.sourceTypes) items.push({ key: 'sourceTypes', value, label: value });
  for (const value of state.rarities) items.push({ key: 'rarities', value, label: value });
  for (const value of state.wears) items.push({ key: 'wears', value, label: value });
  if (state.stattrak !== null) {
    items.push({
      key: 'stattrak',
      label: state.stattrak ? 'StatTrak™ available' : 'No StatTrak™',
    });
  }
  if (state.souvenir !== null) {
    items.push({
      key: 'souvenir',
      label: state.souvenir ? 'Souvenir available' : 'No Souvenir',
    });
  }
  if (state.floatMin !== null) items.push({ key: 'floatMin', label: `Float from ${state.floatMin}` });
  if (state.floatMax !== null) items.push({ key: 'floatMax', label: `Float to ${state.floatMax}` });
  return items;
}

export function renderFilters(
  state: FilterState,
  options: FilterOptions,
  loading: boolean,
): string {
  const chips = activeFilters(state, options);
  return `
    <section class="sr-filters" aria-labelledby="sr-filter-heading">
      <div class="sr-filter-heading">
        <div>
          <p class="sr-eyebrow">SKIN DATABASE</p>
          <h2 id="sr-filter-heading">Find your next skin</h2>
        </div>
        <p>Combine filters to narrow the full SkinRush database.</p>
      </div>
      <form class="sr-filter-form" data-filter-form${loading ? ' aria-busy="true"' : ''}>
        <label class="sr-field sr-field--search">
          <span>Search skins or weapons</span>
          <input type="search" name="search" value="${escapeHtml(state.search)}" autocomplete="off" placeholder="e.g. FAMAS or Spectron">
        </label>
        ${multiSelect('weapon', 'Weapon', options.weapons.map(value => ({ value, label: value })), state.weapons)}
        ${multiSelect('collection', 'Collection', options.collections.map(item => ({ value: item.id, label: item.name })), state.collections)}
        ${multiSelect('case', 'Case', options.cases.map(item => ({ value: item.id, label: item.name })), state.cases)}
        ${multiSelect('source_type', 'Source type', options.sourceTypes.map(value => ({ value, label: value })), state.sourceTypes)}
        ${multiSelect('rarity', 'Rarity', options.rarities.map(value => ({ value, label: value })), state.rarities)}
        ${multiSelect('wear', 'Wear', options.wears.map(item => ({ value: item.name, label: item.name })), state.wears)}
        ${triState('stattrak', 'StatTrak™', state.stattrak)}
        ${triState('souvenir', 'Souvenir', state.souvenir)}
        <fieldset class="sr-float-fields">
          <legend>Float range</legend>
          <label><span>Min</span><input type="number" name="float_min" min="0" max="1" step="0.001" inputmode="decimal" value="${state.floatMin ?? ''}"></label>
          <span aria-hidden="true">–</span>
          <label><span>Max</span><input type="number" name="float_max" min="0" max="1" step="0.001" inputmode="decimal" value="${state.floatMax ?? ''}"></label>
        </fieldset>
      </form>
      ${chips.length ? `
        <div class="sr-active-filters" aria-label="Active filters">
          ${chips.map(chip => `<button type="button" class="sr-filter-chip" data-action="remove-filter" data-filter-key="${escapeHtml(chip.key)}"${chip.value ? ` data-filter-value="${escapeHtml(chip.value)}"` : ''}><span>${escapeHtml(chip.label)}</span><span aria-hidden="true">×</span></button>`).join('')}
          <button type="button" class="sr-clear-button" data-action="clear-filters">Clear all</button>
        </div>` : ''}
    </section>`;
}

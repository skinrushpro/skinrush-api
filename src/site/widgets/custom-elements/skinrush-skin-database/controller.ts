import {
  clearFilters,
  createDefaultFilterState,
  parseFilterState,
  removeFilter,
  serialiseFilterState,
} from './filter-state';
import type { FilterOptions, FilterState, SkinPage, SkinResult } from './types';
import type { SourceKind } from './bridge-contract';

type FilterPatch = Partial<Omit<FilterState, 'limit' | 'offset'>>;
type RemovableKey = Parameters<typeof removeFilter>[1];

interface ApiPort {
  loadOptions(signal?: AbortSignal): Promise<FilterOptions>;
  search(state: FilterState, signal: AbortSignal): Promise<SkinPage>;
}

interface HistoryPort {
  read(): URLSearchParams;
  push(params: URLSearchParams): void;
  subscribe(handler: () => void): () => void;
}

interface SchedulerPort {
  set(callback: () => void, delay: number): unknown;
  clear(handle: unknown): void;
}

export interface ControllerSnapshot {
  state: FilterState;
  options: FilterOptions;
  items: SkinResult[];
  total: number;
  loading: boolean;
  error: string | null;
  selectedId: string | null;
}

interface ControllerDependencies {
  api: ApiPort;
  history: HistoryPort;
  scheduler?: SchedulerPort;
  onChange(snapshot: ControllerSnapshot): void;
  pageSize?: number;
}

const EMPTY_OPTIONS: FilterOptions = {
  weapons: [],
  collections: [],
  cases: [],
  sourceTypes: [],
  rarities: [],
  wears: [],
};

const DEFAULT_SCHEDULER: SchedulerPort = {
  set: (callback, delay) => window.setTimeout(callback, delay),
  clear: handle => window.clearTimeout(handle as number),
};

function publicError(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'The skin database is temporarily unavailable.';
}

export class SkinWidgetController {
  readonly #api: ApiPort;
  readonly #history: HistoryPort;
  readonly #scheduler: SchedulerPort;
  readonly #onChange: (snapshot: ControllerSnapshot) => void;
  readonly #pageSize: number;
  #snapshot: ControllerSnapshot;
  #requestController: AbortController | null = null;
  #optionsController: AbortController | null = null;
  #requestVersion = 0;
  #timer: unknown = null;
  #unsubscribe: (() => void) | null = null;
  #connected = false;

  constructor(dependencies: ControllerDependencies) {
    this.#api = dependencies.api;
    this.#history = dependencies.history;
    this.#scheduler = dependencies.scheduler ?? DEFAULT_SCHEDULER;
    this.#onChange = dependencies.onChange;
    this.#pageSize = dependencies.pageSize ?? 25;
    this.#snapshot = {
      state: createDefaultFilterState(this.#pageSize),
      options: EMPTY_OPTIONS,
      items: [],
      total: 0,
      loading: false,
      error: null,
      selectedId: null,
    };
  }

  get snapshot(): ControllerSnapshot {
    return this.#snapshot;
  }

  #emit(): void {
    this.#onChange(this.#snapshot);
  }

  #set(patch: Partial<ControllerSnapshot>): void {
    this.#snapshot = { ...this.#snapshot, ...patch };
    this.#emit();
  }

  connect(): void {
    if (this.#connected) return;
    this.#connected = true;
    this.#snapshot = {
      ...this.#snapshot,
      state: parseFilterState(this.#history.read(), this.#pageSize),
    };
    this.#unsubscribe = this.#history.subscribe(() => {
      this.#snapshot = {
        ...this.#snapshot,
        state: parseFilterState(this.#history.read(), this.#pageSize),
        selectedId: null,
      };
      this.#refresh();
    });
    this.#emit();
    this.#loadOptions();
    this.#refresh();
  }

  disconnect(): void {
    this.#connected = false;
    if (this.#timer !== null) this.#scheduler.clear(this.#timer);
    this.#timer = null;
    this.#requestController?.abort();
    this.#optionsController?.abort();
    this.#unsubscribe?.();
    this.#unsubscribe = null;
  }

  async #loadOptions(): Promise<void> {
    this.#optionsController?.abort();
    const controller = new AbortController();
    this.#optionsController = controller;
    try {
      const options = await this.#api.loadOptions(controller.signal);
      if (this.#connected && !controller.signal.aborted) this.#set({ options });
    } catch (error) {
      if (this.#connected && !controller.signal.aborted) this.#set({ error: publicError(error) });
    }
  }

  #writeHistory(): void {
    this.#history.push(serialiseFilterState(
      this.#snapshot.state,
      this.#history.read(),
      this.#pageSize,
    ));
  }

  #invalidateRequest(): void {
    this.#requestVersion += 1;
    this.#requestController?.abort();
    this.#requestController = null;
  }

  #scheduleRefresh(debounced: boolean): void {
    if (this.#timer !== null) this.#scheduler.clear(this.#timer);
    this.#timer = null;
    if (debounced) {
      this.#invalidateRequest();
      this.#timer = this.#scheduler.set(() => {
        this.#timer = null;
        this.#refresh();
      }, 300);
      return;
    }
    this.#refresh();
  }

  update(patch: FilterPatch, debounced: boolean): void {
    this.#snapshot = {
      ...this.#snapshot,
      state: { ...this.#snapshot.state, ...patch, offset: 0 },
      selectedId: null,
    };
    this.#writeHistory();
    if (!debounced) this.#emit();
    this.#scheduleRefresh(debounced);
  }

  remove(key: RemovableKey, value?: string): void {
    this.#snapshot = {
      ...this.#snapshot,
      state: removeFilter(this.#snapshot.state, key, value),
      selectedId: null,
    };
    this.#writeHistory();
    this.#emit();
    this.#scheduleRefresh(false);
  }

  clear(): void {
    this.#snapshot = {
      ...this.#snapshot,
      state: clearFilters(this.#snapshot.state, this.#pageSize),
      selectedId: null,
    };
    this.#writeHistory();
    this.#emit();
    this.#scheduleRefresh(false);
  }

  goToOffset(offset: number): void {
    if (!Number.isInteger(offset) || offset < 0) return;
    this.#snapshot = {
      ...this.#snapshot,
      state: { ...this.#snapshot.state, offset },
      selectedId: null,
    };
    this.#writeHistory();
    this.#emit();
    this.#scheduleRefresh(false);
  }

  select(id: string): void {
    this.#set({ selectedId: this.#snapshot.selectedId === id ? null : id });
  }

  applySourceFilter(kind: SourceKind, sourceId: string): void {
    if (!sourceId.trim()) return;
    const key = kind === 'case' ? 'cases' : 'collections';
    this.update({
      [key]: [...new Set([...this.#snapshot.state[key], sourceId])],
    }, false);
  }

  retry(): void {
    if (this.#snapshot.options.weapons.length === 0) this.#loadOptions();
    this.#refresh();
  }

  async #refresh(): Promise<void> {
    this.#invalidateRequest();
    const version = this.#requestVersion;
    const controller = new AbortController();
    this.#requestController = controller;
    this.#set({ loading: true, error: null });
    try {
      const page = await this.#api.search(this.#snapshot.state, controller.signal);
      if (!this.#connected || controller.signal.aborted || version !== this.#requestVersion) return;
      this.#set({ items: page.items, total: page.total, loading: false, error: null });
    } catch (error) {
      if (!this.#connected || controller.signal.aborted || version !== this.#requestVersion) return;
      this.#set({ loading: false, error: publicError(error) });
    }
  }
}

export function findRowEndIndex(cardTops: readonly number[], selectedIndex: number): number {
  if (selectedIndex < 0 || selectedIndex >= cardTops.length) return -1;
  const selectedTop = cardTops[selectedIndex];
  let rowEnd = selectedIndex;
  for (let index = selectedIndex + 1; index < cardTops.length; index += 1) {
    if (Math.abs(cardTops[index] - selectedTop) > 2) break;
    rowEnd = index;
  }
  return rowEnd;
}

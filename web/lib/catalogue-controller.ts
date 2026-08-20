import type { CataloguePage, FilterOptions } from "./catalogue-contract.ts";
import {
  clearFilters,
  createDefaultFilterState,
  parseFilterState,
  removeFilter,
  serialiseFilterState,
  type FilterState,
  type ListFilterKey,
  type ScalarFilterKey,
  type SkinSort,
} from "./filter-state.ts";

interface ApiPort {
  loadOptions(signal: AbortSignal): Promise<FilterOptions>;
  search(state: FilterState, signal: AbortSignal): Promise<CataloguePage>;
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
interface Dependencies {
  api: ApiPort;
  history: HistoryPort;
  onChange(snapshot: CatalogueSnapshot): void;
  scheduler?: SchedulerPort;
  pageSize?: number;
}
type FilterPatch = Partial<Omit<FilterState, "limit" | "offset">>;

export interface CatalogueSnapshot {
  state: FilterState;
  options: FilterOptions;
  items: CataloguePage["items"];
  total: number;
  loading: boolean;
  error: string | null;
}

const EMPTY_OPTIONS: FilterOptions = {
  weapons: [], collections: [], cases: [], sourceTypes: [], rarities: [], wears: [],
};
const DEFAULT_SCHEDULER: SchedulerPort = {
  set: (callback, delay) => window.setTimeout(callback, delay),
  clear: (handle) => window.clearTimeout(handle as number),
};

export class CatalogueController {
  readonly #api: ApiPort;
  readonly #history: HistoryPort;
  readonly #onChange: (snapshot: CatalogueSnapshot) => void;
  readonly #scheduler: SchedulerPort;
  readonly #pageSize: number;
  #snapshot: CatalogueSnapshot;
  #request: AbortController | null = null;
  #optionsRequest: AbortController | null = null;
  #version = 0;
  #timer: unknown = null;
  #unsubscribe: (() => void) | null = null;
  #connected = false;

  constructor(dependencies: Dependencies) {
    this.#api = dependencies.api;
    this.#history = dependencies.history;
    this.#onChange = dependencies.onChange;
    this.#scheduler = dependencies.scheduler ?? DEFAULT_SCHEDULER;
    this.#pageSize = dependencies.pageSize ?? 25;
    this.#snapshot = {
      state: createDefaultFilterState(this.#pageSize), options: EMPTY_OPTIONS,
      items: [], total: 0, loading: false, error: null,
    };
  }

  get snapshot() { return this.#snapshot; }
  #set(patch: Partial<CatalogueSnapshot>) {
    this.#snapshot = { ...this.#snapshot, ...patch };
    this.#onChange(this.#snapshot);
  }

  connect() {
    if (this.#connected) return;
    this.#connected = true;
    this.#snapshot = { ...this.#snapshot, state: parseFilterState(this.#history.read(), this.#pageSize) };
    this.#unsubscribe = this.#history.subscribe(() => {
      this.#snapshot = { ...this.#snapshot, state: parseFilterState(this.#history.read(), this.#pageSize) };
      void this.#refresh();
    });
    this.#onChange(this.#snapshot);
    void this.#loadOptions();
    void this.#refresh();
  }

  disconnect() {
    this.#connected = false;
    if (this.#timer !== null) this.#scheduler.clear(this.#timer);
    this.#timer = null;
    this.#request?.abort();
    this.#optionsRequest?.abort();
    this.#unsubscribe?.();
    this.#unsubscribe = null;
  }

  async #loadOptions() {
    this.#optionsRequest?.abort();
    const request = new AbortController();
    this.#optionsRequest = request;
    try {
      const options = await this.#api.loadOptions(request.signal);
      if (this.#connected && !request.signal.aborted) this.#set({ options });
    } catch {
      if (this.#connected && !request.signal.aborted) this.#set({ error: "The skin database is temporarily unavailable." });
    }
  }

  #writeHistory() {
    this.#history.push(serialiseFilterState(this.#snapshot.state, this.#history.read(), this.#pageSize));
  }

  #invalidate() {
    this.#version += 1;
    this.#request?.abort();
    this.#request = null;
  }

  #schedule(debounced: boolean) {
    if (this.#timer !== null) this.#scheduler.clear(this.#timer);
    this.#timer = null;
    if (debounced) {
      this.#invalidate();
      this.#timer = this.#scheduler.set(() => { this.#timer = null; void this.#refresh(); }, 300);
    } else {
      void this.#refresh();
    }
  }

  update(patch: FilterPatch, debounced = false) {
    this.#snapshot = { ...this.#snapshot, state: { ...this.#snapshot.state, ...patch, offset: 0 } };
    this.#writeHistory();
    this.#onChange(this.#snapshot);
    this.#schedule(debounced);
  }

  toggleListValue(key: ListFilterKey, value: string) {
    const current = this.#snapshot.state[key];
    this.update({ [key]: current.includes(value) ? current.filter((item) => item !== value) : [...current, value] }, false);
  }
  remove(key: ListFilterKey | ScalarFilterKey, value?: string) {
    this.#snapshot = { ...this.#snapshot, state: removeFilter(this.#snapshot.state, key, value) };
    this.#writeHistory(); this.#onChange(this.#snapshot); this.#schedule(false);
  }
  clear() {
    this.#snapshot = { ...this.#snapshot, state: clearFilters(this.#snapshot.state, this.#pageSize) };
    this.#writeHistory(); this.#onChange(this.#snapshot); this.#schedule(false);
  }
  setSort(sort: SkinSort) { this.update({ sort }, false); }
  goToOffset(offset: number) {
    if (!Number.isInteger(offset) || offset < 0) return;
    this.#snapshot = { ...this.#snapshot, state: { ...this.#snapshot.state, offset } };
    this.#writeHistory(); this.#onChange(this.#snapshot); this.#schedule(false);
  }
  retry() { if (this.#snapshot.options.weapons.length === 0) void this.#loadOptions(); void this.#refresh(); }

  async #refresh() {
    this.#invalidate();
    const version = this.#version;
    const request = new AbortController();
    this.#request = request;
    this.#set({ loading: true, error: null });
    try {
      const page = await this.#api.search(this.#snapshot.state, request.signal);
      if (!this.#connected || request.signal.aborted || version !== this.#version) return;
      this.#set({ items: page.items, total: page.total, loading: false, error: null });
    } catch {
      if (!this.#connected || request.signal.aborted || version !== this.#version) return;
      this.#set({ loading: false, error: "The skin database is temporarily unavailable." });
    }
  }
}

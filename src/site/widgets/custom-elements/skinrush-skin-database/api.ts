import { serialiseFilterState } from './filter-state';
import type { FilterOptions, FilterState, SkinPage, SkinResult } from './types';

type FetchImplementation = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

const UNAVAILABLE_MESSAGE = 'The skin database is temporarily unavailable.';
const UNEXPECTED_MESSAGE = 'The skin database returned an unexpected response.';

export class SkinApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SkinApiError';
  }
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isFilterOptions(value: unknown): value is FilterOptions {
  if (!isObject(value)) return false;
  return Array.isArray(value.weapons)
    && Array.isArray(value.collections)
    && Array.isArray(value.cases)
    && Array.isArray(value.sourceTypes)
    && Array.isArray(value.rarities)
    && Array.isArray(value.wears);
}

function parseTotal(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  const total = Number(value);
  return Number.isSafeInteger(total) && total >= 0 ? total : null;
}

export class SkinApiClient {
  readonly #baseUrl: string;
  readonly #fetch: FetchImplementation;

  constructor(
    apiBaseUrl: string,
    fetchImplementation: FetchImplementation = fetch,
  ) {
    this.#baseUrl = apiBaseUrl.replace(/\/+$/, '');
    this.#fetch = fetchImplementation;
  }

  async #request(url: string, signal?: AbortSignal): Promise<Response> {
    try {
      const response = await this.#fetch(url, {
        headers: { Accept: 'application/json' },
        signal,
      });
      if (!response.ok) throw new SkinApiError(UNAVAILABLE_MESSAGE);
      return response;
    } catch (error) {
      if (isAbort(error) || error instanceof SkinApiError) throw error;
      throw new SkinApiError(UNAVAILABLE_MESSAGE);
    }
  }

  async loadOptions(signal?: AbortSignal): Promise<FilterOptions> {
    const response = await this.#request(`${this.#baseUrl}/api/skins/filters`, signal);
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new SkinApiError(UNEXPECTED_MESSAGE);
    }
    if (!isFilterOptions(body)) throw new SkinApiError(UNEXPECTED_MESSAGE);
    return body;
  }

  async search(state: FilterState, signal: AbortSignal): Promise<SkinPage> {
    const params = serialiseFilterState(state);
    params.set('limit', String(state.limit));
    if (state.offset > 0) params.set('offset', String(state.offset));
    const response = await this.#request(
      `${this.#baseUrl}/api/skins?${params.toString()}`,
      signal,
    );

    const total = parseTotal(response.headers.get('X-Total-Count'));
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new SkinApiError(UNEXPECTED_MESSAGE);
    }
    if (!Array.isArray(body) || total === null) {
      throw new SkinApiError(UNEXPECTED_MESSAGE);
    }

    return { items: body as SkinResult[], total };
  }
}

import {
  parseCataloguePage,
  parseFilterOptions,
  type CataloguePage,
  type FilterOptions,
} from "./catalogue-contract.ts";
import { serialiseFilterState, type FilterState } from "./filter-state.ts";

const ERROR_MESSAGE = "The skin database is temporarily unavailable.";

export class CatalogueApi {
  readonly #fetch: typeof fetch;

  constructor(fetchImplementation: typeof fetch = fetch) {
    this.#fetch = fetchImplementation;
  }

  async #request(path: string, signal: AbortSignal): Promise<unknown> {
    let response: Response;
    try {
      response = await this.#fetch(path, {
        headers: { Accept: "application/json" },
        signal,
      });
    } catch (error) {
      if (signal.aborted) throw error;
      throw new Error(ERROR_MESSAGE);
    }
    if (!response.ok) throw new Error(ERROR_MESSAGE);
    try {
      return await response.json();
    } catch {
      throw new Error(ERROR_MESSAGE);
    }
  }

  async loadOptions(signal: AbortSignal): Promise<FilterOptions> {
    const options = parseFilterOptions(await this.#request("/api/catalogue/skins/filters", signal));
    if (!options) throw new Error(ERROR_MESSAGE);
    return options;
  }

  async search(state: FilterState, signal: AbortSignal): Promise<CataloguePage> {
    const params = serialiseFilterState(state);
    const offset = params.get("offset");
    params.delete("offset");
    params.set("limit", String(state.limit));
    if (offset !== null) params.set("offset", offset);
    const page = parseCataloguePage(await this.#request(
      `/api/catalogue/skins?${params.toString()}`,
      signal,
    ));
    if (!page) throw new Error(ERROR_MESSAGE);
    return page;
  }
}

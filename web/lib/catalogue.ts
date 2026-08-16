import {
  parsePublicSkin,
  type CataloguePage,
  type PublicSkin,
} from "./catalogue-contract.ts";

export const CATALOGUE_QUERY_PARAMETERS = [
  "search",
  "weapon",
  "collection",
  "case",
  "source_type",
  "rarity",
  "stattrak",
  "souvenir",
  "float_min",
  "float_max",
  "wear",
  "limit",
  "offset",
] as const;

const QUERY_PARAMETER_SET = new Set<string>(CATALOGUE_QUERY_PARAMETERS);
const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;

interface CatalogueOptions {
  apiBaseUrl: string;
  fetchImplementation?: typeof fetch;
}

export class CatalogueError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "CatalogueError";
    this.status = status;
    this.code = code;
  }
}

function invalidQuery(field: string, message: string): never {
  throw new CatalogueError(400, "INVALID_QUERY", `${field}: ${message}`);
}

function parseIntegerParameter(
  params: URLSearchParams,
  field: "limit" | "offset",
  fallback: number,
  minimum: number,
  maximum?: number,
): number {
  const values = params.getAll(field);
  if (values.length === 0) return fallback;
  if (values.length !== 1 || !/^\d+$/.test(values[0])) {
    return invalidQuery(field, "must be a single integer");
  }

  const value = Number(values[0]);
  if (!Number.isSafeInteger(value) || value < minimum || (maximum !== undefined && value > maximum)) {
    return invalidQuery(
      field,
      maximum === undefined
        ? `must be ${minimum} or greater`
        : `must be between ${minimum} and ${maximum}`,
    );
  }
  return value;
}

function configuredApiOrigin(apiBaseUrl: string): string {
  let url: URL;
  try {
    url = new URL(apiBaseUrl);
  } catch {
    throw new CatalogueError(500, "CATALOGUE_NOT_CONFIGURED", "Catalogue service is not configured.");
  }

  if (
    url.protocol !== "https:"
    || url.username
    || url.password
    || url.search
    || url.hash
    || (url.pathname !== "/" && url.pathname !== "")
  ) {
    throw new CatalogueError(500, "CATALOGUE_NOT_CONFIGURED", "Catalogue service is not configured.");
  }
  return url.origin;
}

export function buildUpstreamUrl(params: URLSearchParams, apiBaseUrl: string): URL {
  for (const key of params.keys()) {
    if (!QUERY_PARAMETER_SET.has(key)) {
      invalidQuery(key, "is not supported");
    }
  }

  const limit = parseIntegerParameter(params, "limit", DEFAULT_LIMIT, 1, MAX_LIMIT);
  parseIntegerParameter(params, "offset", 0, 0);

  const upstream = new URL("/api/skins", configuredApiOrigin(apiBaseUrl));
  for (const [key, value] of params.entries()) {
    upstream.searchParams.append(key, value);
  }
  if (!params.has("limit")) upstream.searchParams.set("limit", String(limit));
  return upstream;
}

function parseTotal(value: string | null): number | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  const total = Number(value);
  return Number.isSafeInteger(total) ? total : null;
}

export async function fetchCatalogue(
  params: URLSearchParams,
  {
    apiBaseUrl,
    fetchImplementation = fetch,
  }: CatalogueOptions,
): Promise<CataloguePage> {
  const upstreamUrl = buildUpstreamUrl(params, apiBaseUrl);
  let response: Response;

  try {
    response = await fetchImplementation(upstreamUrl, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    throw new CatalogueError(502, "CATALOGUE_UNAVAILABLE", "The skin catalogue is temporarily unavailable.");
  }

  if (!response.ok) {
    if (response.status === 400) {
      throw new CatalogueError(400, "INVALID_QUERY", "The catalogue query is invalid.");
    }
    throw new CatalogueError(502, "CATALOGUE_UNAVAILABLE", "The skin catalogue is temporarily unavailable.");
  }

  const total = parseTotal(response.headers.get("X-Total-Count"));
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new CatalogueError(502, "INVALID_UPSTREAM_RESPONSE", "The skin catalogue returned an invalid response.");
  }

  if (!Array.isArray(body) || total === null) {
    throw new CatalogueError(502, "INVALID_UPSTREAM_RESPONSE", "The skin catalogue returned an invalid response.");
  }

  const items = body.map(parsePublicSkin);
  if (items.some((item) => item === null)) {
    throw new CatalogueError(502, "INVALID_UPSTREAM_RESPONSE", "The skin catalogue returned an invalid response.");
  }

  return { items: items as PublicSkin[], total };
}

export async function createCatalogueResponse(
  request: Request,
  options: CatalogueOptions,
): Promise<Response> {
  try {
    const page = await fetchCatalogue(new URL(request.url).searchParams, options);
    return Response.json(page, {
      headers: {
        "Cache-Control": "no-store",
        "X-Total-Count": String(page.total),
      },
    });
  } catch (error) {
    const catalogueError = error instanceof CatalogueError
      ? error
      : new CatalogueError(500, "INTERNAL_ERROR", "The catalogue request could not be completed.");

    return Response.json(
      {
        error: {
          code: catalogueError.code,
          message: catalogueError.message,
        },
      },
      {
        status: catalogueError.status,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}

import React, {
  type FC,
  type FormEvent,
  type MouseEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import ReactDOM from 'react-dom';
import reactToWebComponent from 'react-to-webcomponent';
import { SkinApiClient } from './api';
import {
  createResultsBridgeEvent,
  createResultsBridgePayload,
  dispatchSkinrushCommand,
} from './bridge-contract';
import {
  findRowEndIndex,
  SkinWidgetController,
  type ControllerSnapshot,
} from './controller';
import { createDefaultFilterState } from './filter-state';
import { renderFilters } from './render-filters';
import { renderResults } from './render-results';
import type { FilterOptions, FilterState } from './types';
import styles from './element.module.css';

const DEFAULT_API_BASE_URL = 'https://skinrush-api-8z3s.onrender.com';
const EMPTY_OPTIONS: FilterOptions = {
  weapons: [], collections: [], cases: [], sourceTypes: [], rarities: [], wears: [],
};

interface Props {
  apiBaseUrl?: string;
  pageSize?: number;
  skinrushCommand?: string;
}

function initialSnapshot(pageSize: number): ControllerSnapshot {
  return {
    state: createDefaultFilterState(pageSize),
    options: EMPTY_OPTIONS,
    items: [],
    total: 0,
    loading: true,
    error: null,
    selectedId: null,
  };
}

function historyPort() {
  return {
    read: () => new URLSearchParams(window.location.search),
    push: (params: URLSearchParams) => {
      const url = new URL(window.location.href);
      url.search = params.toString();
      window.history.pushState({}, '', url.toString());
    },
    subscribe: (handler: () => void) => {
      window.addEventListener('popstate', handler);
      return () => window.removeEventListener('popstate', handler);
    },
  };
}

function boundedPageSize(value: number | undefined): number {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= 100
    ? Number(value)
    : 25;
}

function listPatch(
  state: FilterState,
  name: string,
  value: string,
): Partial<FilterState> | null {
  const mapping: Record<string, keyof Pick<FilterState,
    'weapons' | 'collections' | 'cases' | 'sourceTypes' | 'rarities' | 'wears'>> = {
      weapon: 'weapons',
      collection: 'collections',
      case: 'cases',
      source_type: 'sourceTypes',
      rarity: 'rarities',
      wear: 'wears',
    };
  const key = mapping[name];
  if (!key || !value) return null;
  return { [key]: [...new Set([...state[key], value])] };
}

const CustomElement: FC<Props> = ({
  apiBaseUrl = DEFAULT_API_BASE_URL,
  pageSize: pageSizeProp,
  skinrushCommand,
}) => {
  const pageSize = boundedPageSize(pageSizeProp);
  const [snapshot, setSnapshot] = useState<ControllerSnapshot>(() => initialSnapshot(pageSize));
  const [detailAfterIndex, setDetailAfterIndex] = useState<number | null>(null);
  const [layoutRevision, setLayoutRevision] = useState(0);
  const controllerRef = useRef<SkinWidgetController | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const bridgeRevisionRef = useRef(0);
  const commandRevisionRef = useRef(-1);

  useEffect(() => {
    const controller = new SkinWidgetController({
      api: new SkinApiClient(apiBaseUrl),
      history: historyPort(),
      pageSize,
      onChange: setSnapshot,
    });
    controllerRef.current = controller;
    controller.connect();
    return () => {
      controller.disconnect();
      controllerRef.current = null;
    };
  }, [apiBaseUrl, pageSize]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    bridgeRevisionRef.current += 1;
    const payload = createResultsBridgePayload(snapshot, bridgeRevisionRef.current);
    root.dispatchEvent(createResultsBridgeEvent(payload));
  }, [snapshot]);

  useEffect(() => {
    const controller = controllerRef.current;
    if (!controller) return;
    commandRevisionRef.current = dispatchSkinrushCommand(
      controller,
      skinrushCommand ?? null,
      commandRevisionRef.current,
    );
  }, [skinrushCommand, snapshot]);

  useLayoutEffect(() => {
    if (!snapshot.selectedId || !rootRef.current) return;
    const cards = [...rootRef.current.querySelectorAll<HTMLElement>('.sr-card')];
    const selectedIndex = cards.findIndex(element => (
      element.querySelector<HTMLElement>('[data-skin-id]')?.dataset.skinId === snapshot.selectedId
    ));
    const rowEnd = findRowEndIndex(cards.map(element => element.offsetTop), selectedIndex);
    if (rowEnd >= 0) setDetailAfterIndex(rowEnd);
  }, [snapshot.selectedId, snapshot.items, layoutRevision]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === 'undefined') return undefined;
    let width = root.getBoundingClientRect().width;
    const observer = new ResizeObserver(entries => {
      const nextWidth = entries[0]?.contentRect.width ?? width;
      if (Math.abs(nextWidth - width) < 1) return;
      width = nextWidth;
      if (snapshot.selectedId) {
        setDetailAfterIndex(snapshot.items.length - 1);
        setLayoutRevision(value => value + 1);
      }
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [snapshot.selectedId, snapshot.items.length]);

  const markup = useMemo(() => (
    renderFilters(snapshot.state, snapshot.options, snapshot.loading)
    + renderResults({ ...snapshot, detailAfterIndex })
  ), [snapshot, detailAfterIndex]);

  const handleInput = (event: FormEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.name === 'search') {
      controllerRef.current?.update({ search: target.value }, true);
    }
    if (target.name === 'float_min' || target.name === 'float_max') {
      const number = target.value === '' ? null : Number(target.value);
      if (number !== null && (!Number.isFinite(number) || number < 0 || number > 1)) return;
      controllerRef.current?.update(
        target.name === 'float_min' ? { floatMin: number } : { floatMax: number },
        true,
      );
    }
  };

  const handleChange = (event: FormEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLSelectElement)) return;
    const controller = controllerRef.current;
    if (!controller) return;
    const patch = listPatch(controller.snapshot.state, target.name, target.value);
    if (patch) {
      controller.update(patch, false);
      return;
    }
    if (target.name === 'stattrak' || target.name === 'souvenir') {
      const value = target.value === '' ? null : target.value === 'true';
      controller.update(target.name === 'stattrak' ? { stattrak: value } : { souvenir: value }, false);
    }
  };

  const handleClick = (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const action = target.closest<HTMLElement>('[data-action]');
    const controller = controllerRef.current;
    if (!action || !controller) return;
    switch (action.dataset.action) {
      case 'clear-filters': controller.clear(); break;
      case 'retry': controller.retry(); break;
      case 'previous-page':
      case 'next-page': {
        const offset = Number(action.dataset.offset);
        controller.goToOffset(offset);
        rootRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      }
      case 'select-skin': {
        const id = action.dataset.skinId;
        if (id) {
          setDetailAfterIndex(snapshot.items.length - 1);
          controller.select(id);
        }
        break;
      }
      case 'remove-filter': {
        const key = action.dataset.filterKey as Parameters<SkinWidgetController['remove']>[0];
        controller.remove(key, action.dataset.filterValue);
        break;
      }
      default: break;
    }
  };

  return (
    <div className={styles.root} ref={rootRef}>
      <div
        className="sr-shell"
        onInput={handleInput}
        onChange={handleChange}
        onClick={handleClick}
        dangerouslySetInnerHTML={{ __html: markup }}
      />
    </div>
  );
};

const customElement = reactToWebComponent(CustomElement, React, ReactDOM as any, {
  props: {
    apiBaseUrl: 'string',
    pageSize: 'number',
    skinrushCommand: 'string',
  },
});

export default customElement;

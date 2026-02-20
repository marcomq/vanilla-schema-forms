export const DEFAULT_CONFIG = {
  sorting: {
    defaultPriority: [
      'name', 'id', 'title', 'type', 'enabled', 'active', 'url', 'brokers',
      'username', 'password', 'topic', 'group', 'key', 'value', 'required'
    ],
    perObjectPriority: {} as Record<string, string[]>,
    defaultRenderLast: [] as string[],
  },
  visibility: {
    hiddenPaths: [] as string[],
    hiddenKeys: [] as string[],
    customVisibility: undefined as ((node: any, path: string) => boolean) | undefined,
  },
  parser: {
    titleCandidates: [
      'type', 'name', 'kind', 'id', 'strategy', 'action', 'method', 'service', 'provider'
    ] as string[]
  },
  layout: {
    groups: {} as Record<string, { keys: string[], title?: string, className?: string }[]>
  },
  html: {
    skipRootFromName: false,
  },
};

export let CONFIG = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

type ConfigType = typeof DEFAULT_CONFIG;
type PartialConfig = {
  [K in keyof ConfigType]?: Partial<ConfigType[K]>;
};

/**
 * Shallow-merges partial config into the global CONFIG.
 * Only top-level keys within each section are merged (one-level spread).
 * Nested objects (e.g., layout.groups entries) are replaced, not deep-merged.
 * Callers that need additive updates should read CONFIG first and merge manually.
 */
export function setConfig(config: PartialConfig) {
  for (const key in config) {
    if (Object.prototype.hasOwnProperty.call(config, key) && Object.prototype.hasOwnProperty.call(CONFIG, key)) {
      const configKey = key as keyof ConfigType;
      CONFIG[configKey] = { ...CONFIG[configKey], ...config[configKey] };
    }
  }
}

export function resetConfig() {
  CONFIG = JSON.parse(JSON.stringify(DEFAULT_CONFIG));
}
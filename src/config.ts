export const DEFAULT_CONFIG = {
  sorting: {
    defaultPriority: [
      'name', 'id', 'title', 'type', 'enabled', 'active', 'url', 'brokers',
      'username', 'password', 'topic', 'group', 'key', 'value', 'required'
    ],
    perObjectPriority: {} as Record<string, string[]>,
  },
  visibility: {
    hiddenPaths: [] as string[],
    hiddenKeys: [] as string[],
  },
  parser: {
    titleCandidates: [
      'type', 'name', 'kind', 'id', 'mode', 'strategy', 'action', 'method', 'service', 'provider'
    ] as string[]
  },
  layout: {
    groups: {} as Record<string, { keys: string[], title?: string, className?: string }[]>
  }
};

export let CONFIG = JSON.parse(JSON.stringify(DEFAULT_CONFIG));

type ConfigType = typeof DEFAULT_CONFIG;
type PartialConfig = {
  [K in keyof ConfigType]?: Partial<ConfigType[K]>;
};

export function setConfig(config: PartialConfig) {
  if (config.sorting) {
    CONFIG.sorting = { ...CONFIG.sorting, ...config.sorting };
  }
  if (config.visibility) {
    CONFIG.visibility = { ...CONFIG.visibility, ...config.visibility };
  }
  if (config.parser) {
    CONFIG.parser = { ...CONFIG.parser, ...config.parser };
  }
  if (config.layout) {
    CONFIG.layout = { ...CONFIG.layout, ...config.layout };
  }
}
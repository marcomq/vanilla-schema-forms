export const CONFIG = {
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
    ]
  }
};
export const DEFAULT_I18N_MAP = {
  keys: {} as Record<string, string>,
  descriptions: {} as Record<string, string>,
  ui: {
    "add_item": "Add Item",
    "remove": "Remove",
    "add_property": "Add Property",
    "additional_properties": "Additional Properties",
    "type_variant": "Type / Variant",
    "error_schema_load": "Error: Could not load or parse the schema. See console for details.",
    "unsupported_type": "Unsupported type"
  } as Record<string, string>
};

let currentI18nMap = JSON.parse(JSON.stringify(DEFAULT_I18N_MAP));

export function setI18n(map: Partial<typeof DEFAULT_I18N_MAP>) {
  if (map.keys) currentI18nMap.keys = { ...currentI18nMap.keys, ...map.keys };
  if (map.descriptions) currentI18nMap.descriptions = { ...currentI18nMap.descriptions, ...map.descriptions };
  if (map.ui) currentI18nMap.ui = { ...currentI18nMap.ui, ...map.ui };
}

export function resetI18n() {
  currentI18nMap = JSON.parse(JSON.stringify(DEFAULT_I18N_MAP));
}

export function getUiText(key: string, defaultText: string = ""): string {
  return currentI18nMap.ui[key] ?? defaultText;
}

export function getKeyText(key: string, defaultText: string = ""): string {
  return currentI18nMap.keys[key] ?? defaultText;
}

export function getDescriptionText(key: string, defaultText: string = ""): string {
  return currentI18nMap.descriptions[key] ?? defaultText;
}
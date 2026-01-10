export const I18N_MAP: { keys: Record<string, string>, descriptions: Record<string, string>, ui: Record<string, string> } = {
  keys: {
    // Example overrides:
    // "batch_size": "Batch Size (Configured)",
  },
  descriptions: {
    // Example overrides:
    // "batch_size": "Number of items to process at once."
  },
  ui: {
    "add_item": "Add Item",
    "remove": "Remove",
    "add_property": "Add Property",
    "additional_properties": "Additional Properties",
    "type_variant": "Type / Variant",
    "error_schema_load": "Error: Could not load or parse the schema. See console for details.",
    "unsupported_type": "Unsupported type"
  }
};

export function getUiText(key: string, defaultText: string = ""): string {
  return I18N_MAP.ui[key] || defaultText;
}

export function getKeyText(key: string, defaultText: string = ""): string {
  return I18N_MAP.keys[key] || defaultText;
}

export function getDescriptionText(key: string, defaultText: string = ""): string {
  return I18N_MAP.descriptions[key] || defaultText;
}
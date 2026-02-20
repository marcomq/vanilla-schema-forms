import { setConfig, CONFIG } from "./config";

export interface UISchemaElement {
  type: string;
  elements?: UISchemaElement[];
  scope?: string;
  label?: string;
}

/**
 * Adapts a JSON Forms UI Schema to the internal configuration format.
 * 
 * @param uiSchema The JSON Forms UI Schema object.
 * @param rootId The ID of the object in the form to apply this layout to (usually the title).
 */
export function adaptUiSchema(uiSchema: UISchemaElement, rootId: string) {
  const groups: { keys: string[], title?: string, className?: string }[] = [];
  const priority: string[] = [];

  const processElement = (el: UISchemaElement): string[] => {
    const collectedKeys: string[] = [];
    if (el.type === "Control" && el.scope) {
      const key = el.scope.split('/').pop();
      if (key) {
        priority.push(key);
        collectedKeys.push(key);
      }
    } else if (el.type === "HorizontalLayout" && el.elements) {
      const keys: string[] = [];
      el.elements.forEach((child) => {
        keys.push(...processElement(child));
      });
      if (keys.length) {
        groups.push({ keys, className: "d-flex gap-3" });
      }
      collectedKeys.push(...keys);
    } else if (el.type === "Group" && el.elements) {
       const keys: string[] = [];
       el.elements.forEach((child) => {
         keys.push(...processElement(child));
       });
       if (keys.length) {
         groups.push({ keys, title: el.label });
       }
       collectedKeys.push(...keys);
    } else if (el.type === "VerticalLayout" && el.elements) {
      el.elements.forEach((child) => {
        collectedKeys.push(...processElement(child));
      });
    }
    return collectedKeys;
  };

  processElement(uiSchema);

  setConfig({
    layout: {
      groups: { ...CONFIG.layout.groups, [rootId]: groups }
    },
    sorting: {
        perObjectPriority: { ...CONFIG.sorting.perObjectPriority, [rootId]: priority }
    }
  });
}
import { setConfig } from "./config";

export interface UISchemaElement {
  type: string;
  elements?: UISchemaElement[];
  scope?: string;
  label?: string;
  options?: any;
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

  const processElement = (el: UISchemaElement) => {
    if (el.type === "Control" && el.scope) {
      const key = el.scope.split('/').pop();
      if (key) priority.push(key);
    } else if (el.type === "HorizontalLayout" && el.elements) {
      const keys: string[] = [];
      el.elements.forEach((child) => {
        if (child.type === "Control" && child.scope) {
          const key = child.scope.split('/').pop();
          if (key) {
            keys.push(key);
            priority.push(key);
          }
        }
      });
      if (keys.length) {
        groups.push({ keys, className: "d-flex gap-3" });
      }
    } else if (el.type === "Group" && el.elements) {
       const keys: string[] = [];
       el.elements.forEach((child) => {
         if (child.type === "Control" && child.scope) {
           const key = child.scope.split('/').pop();
           if (key) {
             keys.push(key);
             priority.push(key);
           }
         }
       });
       if (keys.length) {
         groups.push({ keys, title: el.label });
       }
    } else if (el.type === "VerticalLayout" && el.elements) {
      el.elements.forEach(processElement);
    }
  };

  processElement(uiSchema);

  setConfig({
    layout: {
      groups: { [rootId]: groups }
    },
    sorting: {
        perObjectPriority: { [rootId]: priority }
    }
  });
}
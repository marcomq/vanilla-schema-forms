import { FormNode } from "./parser";
import { Store } from "./state";
import type { ErrorObject as AjvErrorObject } from "ajv";

export type ErrorObject = AjvErrorObject;

export interface TemplateRenderer<T> {
  renderFieldWrapper(node: FormNode, elementId: string, input: T, className?: string): T;
  renderFieldsetWrapper(node: FormNode, elementId: string, content: T, className?: string): T;
  renderString(node: FormNode, elementId: string, name: string): T;
  renderNumber(node: FormNode, elementId: string, name: string): T;
  renderBoolean(node: FormNode, elementId: string, name: string, attributes?: string): T;
  renderSelect(node: FormNode, elementId: string, options: string[], name: string): T;
  renderObject(node: FormNode, elementId: string, content: T): T;
  renderAdditionalProperties(node: FormNode, elementId: string, options?: { title?: string | null, keyPattern?: string }): T;
  renderOneOf(node: FormNode, elementId: string, name: string): T;
  renderArray(node: FormNode, elementId: string, options?: { isFixedSize?: boolean }): T;
  renderArrayItem(item: T, options?: { isRemovable?: boolean }): T;
  renderAdditionalPropertyRow(value: T, defaultKey?: string, uniqueId?: string): T;
  renderLayoutGroup(title: string | undefined, content: T, className?: string): T;
  renderFormWrapper(content: T): T;
  renderNull(node: FormNode): T;
  renderUnsupported(node: FormNode): T;
  renderHeadlessObject(elementId: string, content: T): T;
  renderSchemaError(error: any): T;
  renderFragment(elements: T[]): T;
}

export interface RenderContext {
  store: Store<any>;
  config: any;
  nodeRegistry: Map<string, FormNode>;
  dataPathRegistry: Map<string, string>;
  elementIdToDataPath: Map<string, string>;
  customRenderers: Record<string, CustomRenderer<any>>;
  rootNode: FormNode;
}

export interface CustomRenderer<T = Node> {
  render?: (node: FormNode, path: string, elementId: string, dataPath: string, context: RenderContext) => T;
  widget?: string;
  options?: string[];
  getDefaultKey?: (index: number) => string;
  renderAdditionalPropertyRow?: (valueHtml: T, defaultKey: string, uniqueId: string) => T;
}
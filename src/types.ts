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
  elementIdToDataPath: Map<string, (string | number)[]>;
  customRenderers: Record<string, CustomRenderer<any>>;
  rootNode: FormNode;
}

/**
 * Interface for defining custom renderers to override default form generation behavior.
 */
export interface CustomRenderer<T = Node> {
  /**
   * A function that renders the form node.
   * If provided, this function is responsible for creating the DOM element for the node.
   * 
   * @param node The schema node to render.
   * @param path The dot-notation path to this node in the schema structure (e.g. "root.users").
   * @param elementId The unique DOM ID for this element.
   * @param dataPath The array path to the data in the store (e.g. ["users", 0, "name"]).
   * @param context The render context containing store, config, etc.
   * @returns The rendered element (usually a DOM Node).
   */
  render?: (node: FormNode, path: string, elementId: string, dataPath: (string | number)[], context: RenderContext) => T;
  
  /**
   * For Additional Properties (Maps): Generates a default key for a new item.
   * 
   * @param index The index of the new item being added.
   * @returns The default key string.
   */
  getDefaultKey?: (index: number) => string;
  
  /**
   * For Additional Properties (Maps): Customizes the rendering of a single key-value row.
   * 
   * @param valueNode The rendered value element (result of renderNode for the value).
   * @param defaultKey The initial key for this row.
   * @param uniqueId A unique ID for the key input field.
   * @param parentDataPath The data path of the parent object containing the additional properties.
   * @param context The full render context.
   * @returns The rendered row element (usually a DOM Node).
   */
  renderAdditionalPropertyRow?: (valueNode: T, defaultKey: string, uniqueId: string, parentDataPath: (string | number)[], context: RenderContext) => T;
}
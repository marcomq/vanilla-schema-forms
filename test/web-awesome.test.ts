import { afterEach, describe, expect, it } from "vitest";
import {
  applyWebAwesomeTheme,
  formatWebAwesomeLabel,
} from "../src/web-awesome/helpers";
import { domRenderer } from "../src/vanilla-renderer/dom-renderer";
import { FormNode } from "../src/core/parser";
import { parseSchema } from "../src/core/parser";
import { Store } from "../src/core/state";
import { renderObject } from "../src/vanilla-renderer/renderer";

let restoreTheme: (() => void) | undefined;

afterEach(() => {
  restoreTheme?.();
  restoreTheme = undefined;
  document.body.innerHTML = "";
});

describe("Web Awesome helpers", () => {
  it("applies a Web Awesome field wrapper to scalar controls", () => {
    restoreTheme = applyWebAwesomeTheme().restore;

    const node: FormNode = {
      type: "string",
      title: "Service URL",
      description: "Used for outbound traffic.",
      required: true,
    };

    const element = domRenderer.renderString(node, "gateway.url", "gateway[url]") as HTMLElement;

    expect(element.className).toContain("vsf-wa-compact-row");
    expect(element.querySelector("label")?.className).toContain("vsf-wa-compact-label");
    expect(element.querySelector(".vsf-wa-compact-content")).not.toBeNull();
    expect(element.querySelector("label")?.textContent).toContain("Service URL");
    expect(element.querySelector("input")?.className).toContain("wa-filled");
    expect(element.querySelector("input")?.className).toContain("vsf-wa-control");
  });

  it("formats fallback labels for indexed fields", () => {
    expect(formatWebAwesomeLabel({ type: "string", title: "" }, "users.0")).toBe("Item 1");
    expect(formatWebAwesomeLabel({ type: "string", title: "" }, "config.basic_auth.1")).toBe("Item 2");
  });

  it("renders primitive additional property values with a Value label", async () => {
    const rootNode = await parseSchema({
      type: "object",
      title: "Headers",
      additionalProperties: { type: "string" },
    });

    const hydrated: FormNode = {
      ...rootNode,
      defaultValue: { authorization: "Bearer token" },
    };

    const context = {
      store: new Store({ authorization: "Bearer token" }),
      rootNode: hydrated,
      config: {
        layout: { groups: {} },
        sorting: { defaultPriority: [], defaultRenderLast: [], perObjectPriority: {} },
        visibility: { hiddenPaths: [], hiddenKeys: [], customVisibility: undefined },
      },
      nodeRegistry: new Map(),
      dataPathRegistry: new Map(),
      elementIdToDataPath: new Map(),
      customRenderers: {},
      uiState: {
        disclosures: new Map(),
        oneOfBranches: new Map(),
        oneOfSelection: new Map(),
      },
    };

    const element = renderObject(context as any, hydrated, "Headers", false, ["Headers"]) as HTMLElement;
    expect(element.textContent).toContain("Value");
    expect(element.textContent).not.toContain("Untitled");
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { adaptUiSchema, UISchemaElement } from '../src/core/ui-schema-adapter';
import { CONFIG, resetConfig } from '../src/core/config';

describe('ui-schema-adapter', () => {
  beforeEach(() => {
    resetConfig();
  });

  it('should adapt HorizontalLayout to layout groups', () => {
    const uiSchema: UISchemaElement = {
      type: "HorizontalLayout",
      elements: [
        { type: "Control", scope: "#/properties/firstName" },
        { type: "Control", scope: "#/properties/lastName" }
      ]
    };

    adaptUiSchema(uiSchema, "Person");

    expect(CONFIG.layout.groups["Person"]).toHaveLength(1);
    expect(CONFIG.layout.groups["Person"][0]).toEqual({
      keys: ["firstName", "lastName"]
    });
    expect(CONFIG.sorting.perObjectPriority["Person"]).toEqual(["firstName", "lastName"]);
  });

  it('should adapt Group to layout groups with title', () => {
    const uiSchema: UISchemaElement = {
      type: "Group",
      label: "Address",
      elements: [
        { type: "Control", scope: "#/properties/street" },
        { type: "Control", scope: "#/properties/city" }
      ]
    };

    adaptUiSchema(uiSchema, "AddressInfo");

    expect(CONFIG.layout.groups["AddressInfo"]).toHaveLength(1);
    expect(CONFIG.layout.groups["AddressInfo"][0]).toEqual({
      keys: ["street", "city"],
      title: "Address"
    });
  });

  it('should not clear global defaultPriority', () => {
    const uiSchema: UISchemaElement = {
      type: "VerticalLayout",
      elements: [{ type: "Control", scope: "#/properties/a" }]
    };
    adaptUiSchema(uiSchema, "Test");
    expect(CONFIG.sorting.defaultPriority.length).toBeGreaterThan(0);
  });
});
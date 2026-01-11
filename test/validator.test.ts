import { describe, it, expect, beforeAll } from "vitest";
import { initValidator, validateData } from "../src/validator";

describe("Validator", () => {
  it("validates standard JSON schema constraints", () => {
    const schema = {
      type: "object",
      properties: {
        age: { type: "number", minimum: 18 }
      },
      required: ["age"]
    };

    initValidator(schema as any);

    expect(validateData({ age: 20 })).toBeNull();
    expect(validateData({ age: 10 })).not.toBeNull();
    expect(validateData({})).not.toBeNull();
  });

  it("validates standard formats (e.g. email)", () => {
    const schema = {
      type: "string",
      format: "email"
    };

    initValidator(schema as any);

    expect(validateData("test@example.com")).toBeNull();
    expect(validateData("invalid-email")).not.toBeNull();
  });

  it("validates custom integer formats (uint8)", () => {
    const schema = {
      type: "number",
      format: "uint8"
    };

    initValidator(schema as any);

    expect(validateData(0)).toBeNull();
    expect(validateData(255)).toBeNull();
    expect(validateData(256)).not.toBeNull(); // > 255
    expect(validateData(-1)).not.toBeNull();  // < 0
    expect(validateData(10.5)).not.toBeNull(); // float
  });

  it("validates custom integer formats (uint64)", () => {
    const schema = {
      type: "number",
      format: "uint64"
    };

    initValidator(schema as any);

    expect(validateData(0)).toBeNull();
    expect(validateData(Number.MAX_SAFE_INTEGER)).toBeNull();
    expect(validateData(-1)).not.toBeNull();
    expect(validateData(10.5)).not.toBeNull();
  });
});
import Ajv2020 from "ajv/dist/2020.js";
import { ValidateFunction } from "ajv";
import addFormats from "ajv-formats";
import { JSONSchema } from "json-schema-to-ts";
import { ErrorObject } from "./types";

let ajv: Ajv2020;
let validateFn: ValidateFunction | null = null;

export function initValidator(schema: JSONSchema) {
  ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv as any);

  // Register custom formats often found in schemas (e.g. from Go/Protobuf)
  ajv.addFormat("uint", { type: "number", validate: (n) => n >= 0 && Number.isInteger(n) });
  ajv.addFormat("uint8", { type: "number", validate: (n) => n >= 0 && n <= 255 && Number.isInteger(n) });
  ajv.addFormat("uint16", { type: "number", validate: (n) => n >= 0 && n <= 65535 && Number.isInteger(n) });
  ajv.addFormat("uint32", { type: "number", validate: (n) => n >= 0 && n <= 4294967295 && Number.isInteger(n) });
  ajv.addFormat("uint64", {
    type: "number",
    validate: (x) => {
      try {
        const n = BigInt(x);
        return n >= 0n && n <= 18446744073709551615n; // 0 bis 2^64 - 1
      } catch (e) {
        return false;
      }
    },
  });

  try {
    validateFn = ajv.compile(schema as any);
  } catch (e) {
    console.error("AJV Compilation Error:", e);
    throw e;
  }
}

export function validateData(data: any): ErrorObject[] | null {
  if (!validateFn) {
    throw new Error("Validator not initialized. Call initValidator(schema) first.");
  }
  const valid = validateFn(data);
  if (valid) return null;
  return validateFn.errors || null;
}
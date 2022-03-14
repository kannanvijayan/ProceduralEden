import { ProtocolObject, ProtocolValue } from "../protocol/types";

/**
 * Validate that an value is an integer.
 */
export function isInteger(value: unknown): value is number {
  return (typeof value === "number") && Number.isInteger(value);
}

/**
 * Validate an value known to be received from a protocol message.
 */
export function isMessageObject(value: ProtocolValue): value is ProtocolObject {
  if (
    typeof(value) !== "object" ||
    value === null ||
    value instanceof Array
  ) {
    return false;
  }
  return true;
}

/**
 * Lift a string into a protocol object, or return undefined.
 */
export function parseProtocolObject(msg: string): ProtocolObject | undefined {
  const obj = JSON.parse(msg);
  return isMessageObject(obj) ? obj : undefined;
}
import { ContentCondition } from "../emailDesign";
import { RenderContext } from "./types";

export function evaluateCondition(
  condition: ContentCondition | undefined,
  context: RenderContext,
): boolean {
  if (!condition) return true;

  const { variable, operator, value } = condition;
  const data = context.options?.data || {};
  const localData = context.localData || {};

  const actualValue = resolveVariable(variable, data, localData);

  switch (operator) {
    case "equals":
      return String(actualValue) === String(value);
    case "not_equals":
      return String(actualValue) !== String(value);
    case "gt":
      return Number(actualValue) > Number(value);
    case "lt":
      return Number(actualValue) < Number(value);
    case "is_set":
      return (
        actualValue !== undefined && actualValue !== null && actualValue !== ""
      );
    case "is_not_set":
      return (
        actualValue === undefined || actualValue === null || actualValue === ""
      );
    default:
      return true;
  }
}

/**
 * Deeply resolve a variable path in the given data objects.
 * Priority: localData (loop) > custom (mock) > contact > workspace > campaign > root
 */
export function resolveVariable(
  path: string,
  data: any,
  localData?: Record<string, any>,
): any {
  if (!path) return undefined;

  const parts = path.split(".");
  const root = parts[0];

  // 1. Try local data (loops)
  if (localData && root in localData) {
    return getDeepValue(localData, parts);
  }

  // 2. Try custom data (mock data from preview)
  if (data.custom) {
    const val = getDeepValue(data.custom, parts);
    if (val !== undefined) return val;
  }

  // 3. Try standard contexts
  if (root === "contact" && data.contact) {
    const val = getDeepValue(data.contact, parts.slice(1));
    if (val !== undefined) return val;

    // Fallback for flat contact in some contexts
    if (data.contact[parts[0]] !== undefined) {
      return getDeepValue(data.contact, parts);
    }
  }

  if (
    (root === "workspace" || root === "project") &&
    (data.workspace || data.project)
  ) {
    return getDeepValue(data.workspace || data.project, parts.slice(1));
  }

  if (
    (root === "trigger" || root === "campaign") &&
    (data.trigger || data.campaign)
  ) {
    return getDeepValue(data.trigger || data.campaign, parts.slice(1));
  }

  // 4. Try top-level of data
  return getDeepValue(data, parts);
}

function getDeepValue(obj: any, parts: string[]): any {
  if (parts.length === 0) return obj;
  let current = obj;
  for (const part of parts) {
    if (current && typeof current === "object" && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return current;
}

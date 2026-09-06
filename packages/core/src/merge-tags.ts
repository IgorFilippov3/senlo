import { resolveVariable } from "./renderer/conditions";
import { escapeMergeValue } from "./renderer/escape";

export interface MergeTag {
  label: string;
  value: string;
  category: "contact" | "project" | "campaign" | "custom";
}

export const STANDARD_MERGE_TAGS: MergeTag[] = [
  { label: "First Name", value: "{{contact.first_name}}", category: "contact" },
  { label: "Last Name", value: "{{contact.last_name}}", category: "contact" },
  { label: "Email", value: "{{contact.email}}", category: "contact" },
  { label: "Workspace Name", value: "{{workspace.name}}", category: "project" },
  { label: "Trigger Name", value: "{{trigger.name}}", category: "campaign" },
  {
    label: "Unsubscribe URL",
    value: "{{unsubscribe_url}}",
    category: "campaign",
  },
];

export interface ReplaceMergeTagsOptions {
  /**
   * Escape resolved values for HTML. Defaults to true: every caller that is
   * building markup needs it, and recipient data is never trusted. Pass false
   * only when substituting into plain text, such as a subject line.
   */
  escape?: boolean;
}

export function replaceMergeTags(
  text: string,
  data: {
    contact?: Record<string, any>;
    project?: { name: string };
    workspace?: { name: string };
    campaign?: { name: string; id?: number };
    trigger?: { name: string; id?: number };
    unsubscribeUrl?: string;
    custom?: Record<string, any>;
  },
  localData?: Record<string, any>,
  options?: ReplaceMergeTagsOptions,
): string {
  if (!text) return text;

  const shouldEscape = options?.escape !== false;
  const format = (value: unknown): string =>
    shouldEscape ? escapeMergeValue(value) : String(value);

  return text.replace(/\{\{(.*?)\}\}/g, (match, tag) => {
    const rawTag = tag.trim();

    if (rawTag === "unsubscribe_url") {
      return format(data.unsubscribeUrl || "[[Unsubscribe Link]]");
    }

    const val = resolveVariable(rawTag, data, localData);

    if (val !== undefined && val !== null) {
      if (typeof val === "object") return match; // Don't stringify objects/arrays into HTML
      return format(val);
    }

    return match;
  });
}

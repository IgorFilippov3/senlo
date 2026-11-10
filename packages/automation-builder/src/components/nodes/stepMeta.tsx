import type { LucideIcon } from "lucide-react";
import { Clock, LogOut, Mail, Split, UserCog, Zap } from "lucide-react";
import type { BuilderTrigger } from "../BuilderContext";

type Data = Record<string, any>;

export interface StepSummary {
  text: string;
  /** The step still needs setting up: shown muted. */
  incomplete?: boolean;
}

export interface StepMeta {
  /** What the step is, as the card's small top line and in the add menu. */
  kind: string;
  icon: LucideIcon;
  /** Tailwind text color class for the icon. */
  tone: string;
  summary: (data: Data, ctx: { triggers: BuilderTrigger[] }) => StepSummary;
}

const EVENT_LABELS: Record<string, string> = {
  contact_added: "Contact added",
  contact_updated: "Contact updated",
  tag_added: "Tag added",
};

/** The trigger card's line: the system event's label, or the custom event's name. */
export function triggerSummary(data: Data): StepSummary {
  const event = typeof data.event === "string" ? data.event : "";
  if (event === "") return { text: "Choose an event", incomplete: true };
  const tag = typeof data.tag === "string" && data.tag.trim() !== "" ? data.tag.trim() : null;
  if (event === "tag_added" && tag) return { text: `Tag added: ${tag}` };
  return { text: EVENT_LABELS[event] ?? event };
}

const UNIT_SINGULAR: Record<string, string> = { minutes: "minute", hours: "hour", days: "day" };

function urlSummary(raw: unknown): StepSummary {
  if (typeof raw !== "string" || raw.trim() === "") return { text: "Set the URL to check", incomplete: true };
  try {
    const url = new URL(raw);
    return { text: `${url.host}${url.pathname === "/" ? "" : url.pathname}` };
  } catch {
    return { text: raw };
  }
}

export const STEP_META: Record<string, StepMeta> = {
  trigger: {
    kind: "Trigger",
    icon: Zap,
    tone: "text-amber-600",
    summary: (data) => (data.label ? { text: data.label } : triggerSummary(data)),
  },
  action: {
    kind: "Send email",
    icon: Mail,
    tone: "text-blue-600",
    summary: (data, { triggers }) => {
      if (data.label) return { text: data.label };
      const id = data.triggerId ?? data.campaignId ?? data.templateId;
      if (id === undefined || id === null || id === "") return { text: "Choose an email", incomplete: true };
      const trigger = triggers.find((t) => String(t.id) === String(id));
      return { text: trigger?.name ?? `Email #${id}` };
    },
  },
  delay: {
    kind: "Wait",
    icon: Clock,
    tone: "text-violet-600",
    summary: (data) => {
      const duration = Number(data.duration) || 1;
      const unit = (data.unit as string) || "days";
      return { text: `${duration} ${duration === 1 ? UNIT_SINGULAR[unit] ?? unit : unit}` };
    },
  },
  condition: {
    kind: "API check",
    icon: Split,
    tone: "text-emerald-600",
    summary: (data) => urlSummary(data.url),
  },
  update_contact: {
    kind: "Update contact",
    icon: UserCog,
    tone: "text-orange-600",
    summary: (data) => {
      if (data.label) return { text: data.label };
      const count = data.updates ? Object.keys(data.updates).length : 0;
      if (count === 0) return { text: "Choose fields to update", incomplete: true };
      return { text: `${count} ${count === 1 ? "field" : "fields"}` };
    },
  },
  exit: {
    kind: "End",
    icon: LogOut,
    tone: "text-gray-600",
    summary: () => ({ text: "End" }),
  },
};

/** The order steps appear in the add menus. */
export const ADDABLE_TYPES = ["action", "delay", "condition", "update_contact", "exit"] as const;

import React, { useId } from "react";
import { isValidEventName, type ConditionGroup, type WorkflowSettings } from "@senlo/core";
import {
  Button,
  FormField,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@senlo/ui";
import { emptyGroup, newRule } from "../conditions/rules";
import { BuilderProvider, type BuilderFieldSuggestions } from "./BuilderContext";
import { RuleEditor } from "./RuleEditor";

export interface WorkflowSettingsFormProps {
  value: WorkflowSettings;
  onChange: (settings: WorkflowSettings) => void;
  /** Event names the project has sent, suggested for the goal. */
  eventNames?: string[];
  fieldSuggestions?: BuilderFieldSuggestions;
}

type Entry = NonNullable<WorkflowSettings["entry"]>;

/**
 * What an automation is (transactional or lifecycle), when it counts as a
 * success (the goal), and who may enter it (once, cooldown). Rendered by the
 * host in its own dialog; saved with `workflows.updateSettings`.
 */
export function WorkflowSettingsForm({
  value,
  onChange,
  eventNames = [],
  fieldSuggestions = { contact: [], event: [] },
}: WorkflowSettingsFormProps) {
  const goalListId = useId();
  const kind = value.kind ?? "transactional";
  const goal = value.goal;
  const entry: Entry = value.entry ?? { mode: "after_exit" };
  const set = (patch: Partial<WorkflowSettings>) => {
    const next = { ...value, ...patch };
    for (const key of Object.keys(next) as Array<keyof WorkflowSettings>) {
      if (next[key] === undefined) delete next[key];
    }
    onChange(next);
  };
  const setEntry = (patch: Partial<Entry>) => {
    const next: Entry = { ...entry, ...patch };
    if (!next.cooldown) delete next.cooldown;
    set({ entry: next.mode === "after_exit" && !next.cooldown ? undefined : next });
  };
  const goalInvalid = goal !== undefined && goal.event !== "" && !isValidEventName(goal.event);

  return (
    <BuilderProvider value={{ triggers: [], eventNames, fieldSuggestions }}>
      <div className="space-y-5">
        <FormField>
          <Label>Kind</Label>
          <Select value={kind} onValueChange={(k) => set({ kind: k === "lifecycle" ? "lifecycle" : undefined })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="transactional">Transactional</SelectItem>
              <SelectItem value="lifecycle">Lifecycle (marketing)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[11px] text-gray-500 mt-1">
            {kind === "lifecycle" ? (
              <>
                Win-back, nurture, upsell: marketing mail by law. A contact who unsubscribes or is suppressed leaves
                the automation at once, and it never starts for them. Put an unsubscribe link (
                <code>{"{{unsubscribe_url}}"}</code>) in every email it sends.
              </>
            ) : (
              <>Mail the contact expects from what they did. An unsubscribed or suppressed contact's emails are skipped; the rest of the automation goes on.</>
            )}
          </p>
        </FormField>

        <FormField>
          <Label>Goal</Label>
          {goal ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  value={goal.event}
                  list={goalListId}
                  onChange={(e) => set({ goal: { ...goal, event: e.target.value.trim().toLowerCase() } })}
                  placeholder="e.g. payment_succeeded"
                  className="font-mono text-xs"
                  aria-invalid={goalInvalid || undefined}
                />
                <Button variant="ghost" size="sm" onClick={() => set({ goal: undefined })}>
                  Remove
                </Button>
              </div>
              <datalist id={goalListId}>
                {eventNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              {goal.filters && goal.filters.rules.length > 0 ? (
                <RuleEditor
                  group={goal.filters as ConditionGroup}
                  place="trigger"
                  onChange={(next) => set({ goal: { event: goal.event, ...(next.rules.length > 0 ? { filters: next } : {}) } })}
                />
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => set({ goal: { ...goal, filters: { ...emptyGroup(), rules: [newRule("event")] } } })}
                >
                  Only when…
                </Button>
              )}
            </div>
          ) : (
            <Button variant="outline" size="sm" onClick={() => set({ goal: { event: "" } })}>
              Set a goal
            </Button>
          )}
          <p className="text-[11px] text-gray-500 mt-1">
            When the contact does this event, their run ends as a success, wherever it is. Conversion = goals reached /
            runs started.
          </p>
        </FormField>

        <FormField>
          <Label>Entry</Label>
          <Select
            value={entry.mode}
            onValueChange={(mode) =>
              setEntry(mode === "after_exit" ? { mode: "after_exit" } : { mode: mode as Entry["mode"], cooldown: undefined })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="after_exit">Again after the previous run ends</SelectItem>
              <SelectItem value="once">Only once per contact</SelectItem>
              <SelectItem value="restart">Restart the run on a new trigger event</SelectItem>
            </SelectContent>
          </Select>
          {entry.mode === "restart" && (
            <p className="text-[11px] text-gray-500 mt-1">
              A contact already in the automation goes back to the first step with the new event, instead of being
              skipped. The same run starts over; it is not counted again. Good for &quot;14 days without a login&quot;.
            </p>
          )}
          {entry.mode === "after_exit" && (
            <div className="mt-2 flex items-center gap-2 text-[12px] text-gray-600">
              <span>Not again within</span>
              <Input
                type="number"
                min={0}
                value={entry.cooldown?.duration ?? 0}
                onChange={(e) => {
                  const duration = Math.max(0, parseInt(e.target.value) || 0);
                  setEntry({ cooldown: duration > 0 ? { duration, unit: entry.cooldown?.unit ?? "days" } : undefined });
                }}
                className="h-8 w-16"
              />
              <Select
                value={entry.cooldown?.unit ?? "days"}
                onValueChange={(unit) =>
                  entry.cooldown && setEntry({ cooldown: { ...entry.cooldown, unit: unit as "minutes" | "hours" | "days" } })
                }
              >
                <SelectTrigger className="h-8 w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="minutes">minutes</SelectItem>
                  <SelectItem value="hours">hours</SelectItem>
                  <SelectItem value="days">days</SelectItem>
                </SelectContent>
              </Select>
              <span>of the last start</span>
            </div>
          )}
        </FormField>
      </div>
    </BuilderProvider>
  );
}

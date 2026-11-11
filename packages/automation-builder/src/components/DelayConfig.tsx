import React, { useId } from "react";
import {
  FormField,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@senlo/ui";
import { fieldOptions } from "../conditions/rules";
import { useBuilderContext } from "./BuilderContext";
import { OnErrorField } from "./OnErrorField";

interface Until {
  source?: "event" | "contact";
  path?: string;
  offset?: { duration?: number; unit?: string; direction?: "before" | "after" };
}

interface Props {
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

const UNITS = (
  <SelectContent>
    <SelectItem value="minutes">Minutes</SelectItem>
    <SelectItem value="hours">Hours</SelectItem>
    <SelectItem value="days">Days</SelectItem>
  </SelectContent>
);

/** Wait for a time, or until a date from the trigger event or the contact (with an offset). */
export function DelayConfig({ data, onChange }: Props) {
  const { fieldSuggestions } = useBuilderContext();
  const listId = useId();
  const mode = data.mode === "until" ? "until" : "for";
  const until = (data.until as Until | undefined) ?? { source: "event", path: "" };
  const setUntil = (next: Partial<Until>) => onChange({ until: { ...until, ...next } });
  const offset = until.offset ?? { duration: 0, unit: "days", direction: "before" as const };

  return (
    <div className="space-y-4">
      <FormField>
        <Label>Wait</Label>
        <Select
          value={mode}
          onValueChange={(value) =>
            onChange(value === "until" ? { mode: "until", until } : { mode: "for", duration: data.duration ?? 1, unit: data.unit ?? "days" })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="for">For a time</SelectItem>
            <SelectItem value="until">Until a date</SelectItem>
          </SelectContent>
        </Select>
      </FormField>

      {mode === "for" ? (
        <div className="grid grid-cols-2 gap-2">
          <FormField>
            <Label>Duration</Label>
            <Input
              type="number"
              value={(data.duration as number) || 1}
              onChange={(e) => onChange({ duration: parseInt(e.target.value) || 0 })}
            />
          </FormField>
          <FormField>
            <Label>Unit</Label>
            <Select value={(data.unit as string) || "days"} onValueChange={(unit) => onChange({ unit })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              {UNITS}
            </Select>
          </FormField>
        </div>
      ) : (
        <>
          <FormField>
            <Label>Date from</Label>
            <Select value={until.source ?? "event"} onValueChange={(source) => setUntil({ source: source as Until["source"] })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="event">Trigger event</SelectItem>
                <SelectItem value="contact">Contact</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={until.path ?? ""}
              list={listId}
              onChange={(e) => setUntil({ path: e.target.value.trim() })}
              placeholder={until.source === "contact" ? "e.g. renews_at" : "e.g. trial_ends_at"}
              className="mt-2 font-mono text-xs"
            />
            <datalist id={listId}>
              {fieldOptions(until.source ?? "event", fieldSuggestions).map((field) => (
                <option key={field} value={field} />
              ))}
            </datalist>
          </FormField>
          <FormField>
            <Label>Offset</Label>
            <div className="grid grid-cols-3 gap-1">
              <Input
                type="number"
                min={0}
                value={offset.duration ?? 0}
                onChange={(e) => setUntil({ offset: { ...offset, duration: Math.max(0, parseInt(e.target.value) || 0) } })}
              />
              <Select value={offset.unit ?? "days"} onValueChange={(unit) => setUntil({ offset: { ...offset, unit } })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                {UNITS}
              </Select>
              <Select
                value={offset.direction ?? "before"}
                onValueChange={(direction) => setUntil({ offset: { ...offset, direction: direction as "before" | "after" } })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="before">before</SelectItem>
                  <SelectItem value="after">after</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              The field must hold a date (ISO 8601, e.g. 2026-12-01 or 2026-12-01T09:00:00Z). A date already past
              continues at once; a missing one counts as a failure of this step.
            </p>
          </FormField>
          <OnErrorField type="delay" value={data.onError} onChange={(onError) => onChange({ onError })} />
        </>
      )}
    </div>
  );
}

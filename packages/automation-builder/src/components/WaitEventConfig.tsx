import React, { useId } from "react";
import { isValidEventName, type ConditionGroup } from "@senlo/core";
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
import { useBuilderContext } from "./BuilderContext";
import { OnErrorField } from "./OnErrorField";
import { RuleEditor } from "./RuleEditor";

interface Props {
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

/**
 * Wait for event: Yes when the contact does the event (or already did, since
 * the run or this step started), No when the timeout passes first.
 */
export function WaitEventConfig({ data, onChange }: Props) {
  const { eventNames } = useBuilderContext();
  const listId = useId();
  const event = typeof data.event === "string" ? data.event : "";
  const invalid = event !== "" && !isValidEventName(event);
  const timeout = (data.timeout as { duration?: number; unit?: string } | undefined) ?? { duration: 3, unit: "days" };
  const filters = data.filters as ConditionGroup | undefined;

  return (
    <div className="space-y-4">
      <FormField>
        <Label>Event</Label>
        <Input
          value={event}
          list={listId}
          onChange={(e) => onChange({ event: e.target.value.trim().toLowerCase() })}
          placeholder="e.g. project_created"
          className="font-mono text-xs"
          aria-invalid={invalid || undefined}
        />
        <datalist id={listId}>
          {eventNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <p className={`text-[10px] mt-1 ${invalid ? "text-red-600" : "text-gray-400"}`}>
          {invalid
            ? "Lowercase letters, digits and _ . : -, starting with a letter or digit."
            : "Yes when the contact does it; its payload is this step's output for later rules."}
        </p>
      </FormField>

      <FormField>
        <Label>Wait up to</Label>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            min={1}
            value={timeout.duration ?? 1}
            onChange={(e) => onChange({ timeout: { ...timeout, duration: Math.max(1, parseInt(e.target.value) || 1) } })}
          />
          <Select value={timeout.unit ?? "days"} onValueChange={(unit) => onChange({ timeout: { ...timeout, unit } })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="minutes">Minutes</SelectItem>
              <SelectItem value="hours">Hours</SelectItem>
              <SelectItem value="days">Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p className="text-[10px] text-gray-400 mt-1">No when this time passes first.</p>
      </FormField>

      <FormField>
        <Label>Counts if done</Label>
        <Select value={data.since === "step_start" ? "step_start" : "run_start"} onValueChange={(since) => onChange({ since })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="run_start">Since the automation started for the contact</SelectItem>
            <SelectItem value="step_start">Since this step started</SelectItem>
          </SelectContent>
        </Select>
      </FormField>

      <FormField>
        <Label>Only when</Label>
        {filters && filters.rules.length > 0 ? (
          <RuleEditor
            group={filters}
            place="trigger"
            onChange={(next) => onChange({ filters: next.rules.length > 0 ? next : undefined })}
          />
        ) : (
          <Button variant="outline" size="sm" onClick={() => onChange({ filters: { ...emptyGroup(), rules: [newRule("event")] } })}>
            Add a filter
          </Button>
        )}
      </FormField>

      <OnErrorField type="wait_event" value={data.onError} onChange={(onError) => onChange({ onError })} />
    </div>
  );
}

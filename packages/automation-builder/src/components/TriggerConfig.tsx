import React, { useId } from "react";
import { isSystemEvent, isValidEventName } from "@senlo/core";
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
import { useBuilderContext } from "./BuilderContext";

/** The select's value for a custom event; not an event name (no underscore prefix is valid). */
const CUSTOM = "__custom__";

const SYSTEM_OPTIONS = [
  { value: "contact_added", label: "Contact added" },
  { value: "contact_updated", label: "Contact updated" },
  { value: "tag_added", label: "Tag added" },
] as const;

const MAX_SUGGESTIONS = 8;

interface Props {
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

/**
 * What starts the automation: one of the system events, or a custom event
 * name the app sends to `POST /api/events`, with the project's recent names
 * as suggestions. A "Tag added" trigger can be narrowed to one tag.
 */
export function TriggerConfig({ data, onChange }: Props) {
  const { eventNames } = useBuilderContext();
  const nameId = useId();
  const event = typeof data.event === "string" ? data.event : "";
  const mode = isSystemEvent(event) ? event : CUSTOM;
  const tag = typeof data.tag === "string" ? data.tag : "";

  const invalid = mode === CUSTOM && event !== "" && !isValidEventName(event);
  const suggestions = eventNames
    .filter((name) => !isSystemEvent(name) && name !== event && name.startsWith(event))
    .slice(0, MAX_SUGGESTIONS);

  const changeMode = (value: string) => {
    if (value === CUSTOM) {
      onChange({ event: "", tag: undefined });
    } else {
      onChange({ event: value, tag: value === "tag_added" ? data.tag : undefined });
    }
  };

  return (
    <div className="space-y-4">
      <FormField>
        <Label>Starts when</Label>
        <Select value={mode} onValueChange={changeMode}>
          <SelectTrigger>
            <SelectValue placeholder="Choose an event" />
          </SelectTrigger>
          <SelectContent>
            {SYSTEM_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
            <SelectItem value={CUSTOM}>Custom event</SelectItem>
          </SelectContent>
        </Select>
      </FormField>

      {mode === CUSTOM && (
        <FormField>
          <Label htmlFor={nameId}>Event name</Label>
          <Input
            id={nameId}
            value={event}
            onChange={(e) => onChange({ event: e.target.value.trim().toLowerCase() })}
            placeholder="e.g. trial_started"
            className="font-mono text-xs"
            aria-invalid={invalid || undefined}
          />
          {invalid ? (
            <p className="text-[10px] text-red-600 mt-1">
              Lowercase letters, digits and _ . : -, starting with a letter or digit, up to 64 characters.
            </p>
          ) : (
            <p className="text-[10px] text-gray-400 mt-1">
              Send it as <code>event</code> to <code>POST /api/events</code>. Its <code>payload</code> is{" "}
              <code>{"{{event.*}}"}</code> in this automation&apos;s emails.
            </p>
          )}
          {suggestions.length > 0 && (
            <div className="mt-2">
              <p className="text-[10px] text-gray-500 mb-1">Sent recently</p>
              <div className="flex flex-wrap gap-1">
                {suggestions.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => onChange({ event: name })}
                    className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px] text-gray-700 hover:bg-gray-100"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </FormField>
      )}

      {mode === "tag_added" && (
        <FormField>
          <Label>Only for tag</Label>
          <Input
            value={tag}
            onChange={(e) => onChange({ tag: e.target.value || undefined })}
            placeholder="Any tag"
          />
          <p className="text-[10px] text-gray-400 mt-1">
            Leave empty to start on any tag. Tags come from <code>payload.tags</code> of a <code>tag_added</code> event.
          </p>
        </FormField>
      )}
    </div>
  );
}

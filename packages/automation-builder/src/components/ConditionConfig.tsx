import React from "react";
import type { ConditionGroup } from "@senlo/core";
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
import { useAutomationStore } from "../store/automationStore";
import { useBuilderContext } from "./BuilderContext";
import { OnErrorField } from "./OnErrorField";
import { RuleEditor, type EmailStepOption } from "./RuleEditor";

interface Props {
  nodeId: string;
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

/**
 * A Condition decides by rules (contact, trigger event, history, email
 * engagement) or by calling the user's API.
 */
export function ConditionConfig({ nodeId, data, onChange }: Props) {
  const mode = data.mode === "rules" ? "rules" : "api";
  const emailSteps = useEmailSteps(nodeId);

  return (
    <div className="space-y-4">
      <FormField>
        <Label>Decide by</Label>
        <Select value={mode} onValueChange={(value) => onChange({ mode: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="rules">Rules</SelectItem>
            <SelectItem value="api">Call my API</SelectItem>
          </SelectContent>
        </Select>
      </FormField>

      {mode === "rules" ? (
        <FormField>
          <Label>Yes when</Label>
          <RuleEditor
            group={data.conditions as ConditionGroup | undefined}
            onChange={(conditions) => onChange({ conditions })}
            place="condition"
            emailSteps={emailSteps}
          />
          <p className="text-[10px] text-gray-400 mt-1">
            Fields of the trigger event are its <code>payload</code>; contact fields are its attributes.
          </p>
        </FormField>
      ) : (
        <FormField>
          <Label>API URL</Label>
          <Input
            value={(data.url as string) || ""}
            onChange={(e) => onChange({ url: e.target.value })}
            placeholder="https://api.example.com/check"
          />
          <p className="text-[10px] text-gray-400 mt-1">
            Senlo POSTs the contact and the trigger event to this URL. Status 200 = YES, any other = NO. A
            timeout, 429 or 5xx is retried first.
          </p>
        </FormField>
      )}

      <OnErrorField type="condition" value={data.onError} onChange={(onError) => onChange({ onError })} />
    </div>
  );
}

/** The email steps before this one, as an email rule may name them. */
function useEmailSteps(nodeId: string): EmailStepOption[] {
  const { nodes, edges } = useAutomationStore();
  const { triggers } = useBuilderContext();
  const before = new Set<string>();
  const stack = [nodeId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    for (const e of edges) {
      if (e.target === id && !before.has(e.source)) {
        before.add(e.source);
        stack.push(e.source);
      }
    }
  }
  return nodes
    .filter((n) => n.type === "action" && before.has(n.id))
    .map((n) => {
      const data = n.data as Record<string, unknown>;
      const trigger = triggers.find((t) => String(t.id) === String(data.triggerId));
      return { id: n.id, label: (data.label as string) || trigger?.name || "Email" };
    });
}

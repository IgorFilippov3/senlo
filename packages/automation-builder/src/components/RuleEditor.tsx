import React, { useId } from "react";
import { Plus, X } from "lucide-react";
import {
  isConditionGroup,
  isValidEventName,
  RULE_OPERATORS,
  VALUELESS_OPERATORS,
  type ConditionGroup,
  type ConditionPlace,
  type ConditionRule,
  type ConditionSource,
  type RuleOperator,
} from "@senlo/core";
import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@senlo/ui";
import {
  EMAIL_STATE_LABELS,
  OPERATOR_LABELS,
  SOURCES_BY_PLACE,
  SOURCE_LABELS,
  appendAt,
  emptyGroup,
  fieldOptions,
  newRule,
  removeAt,
  replaceAt,
  withOperator,
  withSource,
  type RulePath,
} from "../conditions/rules";
import { useBuilderContext } from "./BuilderContext";

export interface EmailStepOption {
  id: string;
  label: string;
}

interface Props {
  group: ConditionGroup | undefined;
  onChange: (group: ConditionGroup) => void;
  place: ConditionPlace;
  /** Email steps of the automation, for email rules. */
  emailSteps?: EmailStepOption[];
}

/**
 * Rules in a group ("all" or "any"), with one level of nested groups: what
 * a Condition in rules mode checks, or a trigger's filters.
 */
export function RuleEditor({ group = emptyGroup(), onChange, place, emailSteps = [] }: Props) {
  return <GroupEditor root={group} path={[]} group={group} onChange={onChange} place={place} emailSteps={emailSteps} />;
}

function GroupEditor({
  root,
  path,
  group,
  onChange,
  place,
  emailSteps,
}: {
  root: ConditionGroup;
  path: RulePath;
  group: ConditionGroup;
  onChange: (group: ConditionGroup) => void;
  place: ConditionPlace;
  emailSteps: EmailStepOption[];
}) {
  const nested = path.length > 0;
  const firstSource = SOURCES_BY_PLACE[place][0];
  const add = (item: ConditionRule | ConditionGroup) => onChange(appendAt(root, path, item));

  return (
    <div className={nested ? "rounded-md border border-dashed border-gray-300 p-2 space-y-2" : "space-y-2"}>
      <div className="flex items-center gap-2 text-[11px] text-gray-600">
        <span>Match</span>
        <Select
          value={group.op}
          onValueChange={(op) => onChange(replaceAt(root, path, { ...group, op: op as "and" | "or" }))}
        >
          <SelectTrigger className="h-7 w-20 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="and">all</SelectItem>
            <SelectItem value="or">any</SelectItem>
          </SelectContent>
        </Select>
        <span>of these</span>
        {nested && (
          <Button variant="ghost" size="icon-sm" className="ml-auto" aria-label="Remove group" onClick={() => onChange(removeAt(root, path))}>
            <X size={12} />
          </Button>
        )}
      </div>

      {group.rules.map((item, index) =>
        isConditionGroup(item) ? (
          <GroupEditor
            key={index}
            root={root}
            path={[...path, index]}
            group={item}
            onChange={onChange}
            place={place}
            emailSteps={emailSteps}
          />
        ) : (
          <RuleRow
            key={index}
            rule={item}
            place={place}
            emailSteps={emailSteps}
            onChange={(rule) => onChange(replaceAt(root, [...path, index], rule))}
            onRemove={() => onChange(removeAt(root, [...path, index]))}
          />
        ),
      )}

      <div className="flex gap-1">
        <Button variant="outline" size="sm" onClick={() => add(newRule(firstSource))}>
          <Plus size={12} className="mr-1" /> Rule
        </Button>
        {!nested && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => add({ op: group.op === "and" ? "or" : "and", rules: [newRule(firstSource)] })}
          >
            <Plus size={12} className="mr-1" /> Group
          </Button>
        )}
      </div>
    </div>
  );
}

function RuleRow({
  rule,
  place,
  emailSteps,
  onChange,
  onRemove,
}: {
  rule: ConditionRule;
  place: ConditionPlace;
  emailSteps: EmailStepOption[];
  onChange: (rule: ConditionRule) => void;
  onRemove: () => void;
}) {
  const { fieldSuggestions, eventNames, historyRetentionDays } = useBuilderContext();
  const listId = useId();

  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-2 space-y-1.5">
      <div className="flex items-center gap-1">
        <Select
          value={rule.source}
          onValueChange={(source) => onChange(withSource(rule, source as ConditionSource, { emailNodeId: emailSteps[0]?.id }))}
        >
          <SelectTrigger className="h-7 text-[11px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SOURCES_BY_PLACE[place].map((source) => (
              <SelectItem key={source} value={source}>
                {SOURCE_LABELS[source]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="ghost" size="icon-sm" aria-label="Remove rule" onClick={onRemove}>
          <X size={12} />
        </Button>
      </div>

      {(rule.source === "contact" || rule.source === "event" || rule.source === "step") && (
        <>
          <Input
            value={rule.path}
            list={listId}
            onChange={(e) => onChange({ ...rule, path: e.target.value.trim() })}
            placeholder={rule.source === "contact" ? "plan, email, tags…" : "field in the payload, e.g. reason"}
            className="h-7 font-mono text-[11px]"
          />
          <datalist id={listId}>
            {fieldOptions(rule.source, fieldSuggestions).map((field) => (
              <option key={field} value={field} />
            ))}
          </datalist>
          <Select value={rule.operator} onValueChange={(op) => onChange(withOperator(rule, op as RuleOperator))}>
            <SelectTrigger className="h-7 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RULE_OPERATORS.map((op) => (
                <SelectItem key={op} value={op}>
                  {OPERATOR_LABELS[op]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!VALUELESS_OPERATORS.includes(rule.operator) && (
            <Input
              value={rule.value === undefined || rule.value === null ? "" : String(rule.value)}
              onChange={(e) => onChange({ ...rule, value: e.target.value })}
              placeholder={rule.operator === "in" ? "a, b, c" : "value"}
              className="h-7 text-[11px]"
            />
          )}
        </>
      )}

      {rule.source === "history" && (
        <>
          <Select value={rule.did ? "did" : "did_not"} onValueChange={(v) => onChange({ ...rule, did: v === "did" })}>
            <SelectTrigger className="h-7 text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="did">did</SelectItem>
              <SelectItem value="did_not">did not do</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={rule.event}
            list={listId}
            onChange={(e) => onChange({ ...rule, event: e.target.value.trim().toLowerCase() })}
            placeholder="event name, e.g. project_created"
            className="h-7 font-mono text-[11px]"
            aria-invalid={(rule.event !== "" && !isValidEventName(rule.event)) || undefined}
          />
          <datalist id={listId}>
            {eventNames.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <div className="flex items-center gap-1 text-[11px] text-gray-600">
            <span>in the last</span>
            <Input
              type="number"
              min={1}
              value={rule.withinDays ?? ""}
              onChange={(e) => {
                const days = parseInt(e.target.value, 10);
                const { withinDays: _old, ...rest } = rule;
                onChange(Number.isInteger(days) && days > 0 ? { ...rest, withinDays: days } : rest);
              }}
              placeholder="any"
              className="h-7 w-16 text-[11px]"
            />
            <span>days</span>
          </div>
          {historyRetentionDays !== undefined && historyRetentionDays !== null && (
            <p className="text-[10px] text-gray-400">
              Event history is kept {historyRetentionDays} {historyRetentionDays === 1 ? "day" : "days"} in this workspace;
              older events do not count.
            </p>
          )}
        </>
      )}

      {rule.source === "email" &&
        (emailSteps.length === 0 ? (
          <p className="text-[10px] text-gray-500">Add an email step before this one to check it.</p>
        ) : (
          <>
            <Select value={rule.nodeId || undefined} onValueChange={(nodeId) => onChange({ ...rule, nodeId })}>
              <SelectTrigger className="h-7 text-[11px]">
                <SelectValue placeholder="Choose an email step" />
              </SelectTrigger>
              <SelectContent>
                {emailSteps.map((step) => (
                  <SelectItem key={step.id} value={step.id}>
                    {step.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={rule.state} onValueChange={(state) => onChange({ ...rule, state: state as typeof rule.state })}>
              <SelectTrigger className="h-7 text-[11px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(EMAIL_STATE_LABELS).map(([state, label]) => (
                  <SelectItem key={state} value={state}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        ))}
    </div>
  );
}

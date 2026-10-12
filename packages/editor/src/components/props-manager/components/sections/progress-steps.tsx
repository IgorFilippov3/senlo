"use client";

import {
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@senlo/ui";
import type { ProgressStep } from "@senlo/core";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

interface ProgressStepsProps {
  steps: ProgressStep[];
  onChange: (steps: ProgressStep[]) => void;
  /** Per-step errors from the form, keyed by index. */
  errors?: Array<{ value?: { message?: string }; label?: { message?: string } } | undefined>;
}

type PreviewState = NonNullable<ProgressStep["previewState"]>;

const PREVIEW_STATES: { value: PreviewState; label: string }[] = [
  { value: "completed", label: "Completed" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
];

/**
 * The steps of a progress bar, in order: what the recipient reads, and the
 * status code that selects the step. Order is the journey, so steps move up
 * and down rather than being sorted.
 *
 * Each step also carries the state the canvas draws it in. It is there so the
 * author can see every colour while styling; a message never reads it.
 */
export const ProgressSteps = ({ steps, onChange, errors }: ProgressStepsProps) => {
  const update = (index: number, patch: Partial<ProgressStep>) => {
    onChange(steps.map((step, i) => (i === index ? { ...step, ...patch } : step)));
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;

    const next = [...steps];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  /**
   * A new step needs a value nobody else has, or the form is invalid the moment
   * it appears. `step_5`, `step_6`, … - the author renames it to the real code.
   */
  const add = () => {
    const taken = new Set(steps.map((step) => step.value.trim().toLowerCase()));
    let n = steps.length + 1;
    while (taken.has(`step_${n}`)) n += 1;
    onChange([
      ...steps,
      { label: `Step ${n}`, value: `step_${n}`, previewState: "completed" },
    ]);
  };

  return (
    <div className="space-y-3">
      {steps.map((step, index) => {
        const valueError = errors?.[index]?.value?.message;

        return (
          <div
            key={index}
            className="border border-zinc-200 rounded-md p-3 bg-zinc-50 space-y-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500">
                Step {index + 1}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  title="Move up"
                >
                  <ArrowUp size={14} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => move(index, 1)}
                  disabled={index === steps.length - 1}
                  title="Move down"
                >
                  <ArrowDown size={14} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onChange(steps.filter((_, i) => i !== index))}
                  disabled={steps.length === 1}
                  className="text-red-600"
                  title={steps.length === 1 ? "A progress bar needs at least one step" : "Remove step"}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>

            <Input
              value={step.label}
              placeholder="Label, e.g. Shipped"
              onChange={(e) => update(index, { label: e.target.value })}
            />
            <Input
              value={step.value}
              placeholder="Status value, e.g. shipped"
              className="font-mono text-xs"
              aria-invalid={Boolean(valueError)}
              onChange={(e) => update(index, { value: e.target.value })}
            />
            {valueError && (
              <p className="text-xs text-red-600">{valueError}</p>
            )}
            <Select
                value={step.previewState ?? "completed"}
                onValueChange={(val) =>
                  update(index, { previewState: val as PreviewState })
                }
              >
                <SelectTrigger title="How this step looks in the canvas. Messages use the status from your data.">
                  <SelectValue placeholder="Completed" />
                </SelectTrigger>
                <SelectContent>
                  {PREVIEW_STATES.map((state) => (
                    <SelectItem key={state.value} value={state.value}>
                      {state.label}
                    </SelectItem>
                  ))}
                </SelectContent>
            </Select>
          </div>
        );
      })}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={add}
        className="w-full"
      >
        <Plus size={14} className="mr-1" />
        Add step
      </Button>
    </div>
  );
};

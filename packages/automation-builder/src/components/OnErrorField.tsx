import React from "react";
import {
  FormField,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@senlo/ui";

interface Props {
  /** The step type: a condition continues down its No branch, other steps are skipped. */
  type: string;
  value: unknown;
  onChange: (value: "fail" | "continue") => void;
}

/**
 * What a step does when it fails for good, after the retries of a
 * temporary error: stop the run (the default) or go on.
 */
export function OnErrorField({ type, value, onChange }: Props) {
  const current = value === "continue" ? "continue" : "fail";
  return (
    <FormField>
      <Label>If this step fails</Label>
      <Select value={current} onValueChange={(v) => onChange(v as "fail" | "continue")}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="fail">Stop the run</SelectItem>
          <SelectItem value="continue">
            {type === "condition" || type === "wait_event" ? "Take the No branch" : "Skip it and continue"}
          </SelectItem>
        </SelectContent>
      </Select>
      <p className="text-[10px] text-gray-400 mt-1">
        Timeouts and server errors are retried a few times first.
      </p>
    </FormField>
  );
}

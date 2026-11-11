// SPDX-FileCopyrightText: 2026 Igor Filippov <https://github.com/IgorFilippov3>
//
// SPDX-License-Identifier: AGPL-3.0-or-later

import React from "react";
import {
  HTTP_STEP_DEFAULT_TIMEOUT_S,
  HTTP_STEP_MAX_TIMEOUT_S,
  HTTP_STEP_METHODS,
  validateHttpStep,
  type HttpStepHeader,
} from "@senlo/core";
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
  Textarea,
} from "@senlo/ui";
import { Plus, Trash2 } from "lucide-react";
import { OnErrorField } from "./OnErrorField";

interface Props {
  data: Record<string, unknown>;
  onChange: (data: Record<string, unknown>) => void;
}

/**
 * HTTP request: calls a URL of the user's (a webhook, their API) with the
 * contact, the trigger event and earlier outputs in the body. Header values
 * are secrets: a saved one comes back sealed and shows as dots; typing
 * replaces it. The response (status, body) is this step's output.
 */
export function HttpRequestConfig({ data, onChange }: Props) {
  const method = (data.method as string) || "POST";
  const headers = (Array.isArray(data.headers) ? data.headers : []) as HttpStepHeader[];
  const problems = typeof data.url === "string" && data.url !== "" ? validateHttpStep(data) : [];

  const setHeader = (index: number, patch: Partial<HttpStepHeader>) =>
    onChange({ headers: headers.map((h, i) => (i === index ? { ...h, ...patch } : h)) });

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <FormField className="w-28">
          <Label>Method</Label>
          <Select value={method} onValueChange={(m) => onChange({ method: m })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {HTTP_STEP_METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        <FormField className="flex-1">
          <Label>URL</Label>
          <Input
            value={(data.url as string) || ""}
            onChange={(e) => onChange({ url: e.target.value })}
            placeholder="https://api.example.com/hooks/senlo"
            className="font-mono text-xs"
          />
        </FormField>
      </div>
      {problems.length > 0 && <p className="text-[10px] text-red-600">{problems[0]}</p>}

      <FormField>
        <Label>Headers</Label>
        <div className="space-y-2">
          {headers.map((header, index) => (
            <div key={index} className="flex gap-1.5 items-center">
              <Input
                value={header.name}
                onChange={(e) => setHeader(index, { name: e.target.value })}
                placeholder="Authorization"
                className="font-mono text-[11px] h-8 w-32"
              />
              <Input
                type="password"
                autoComplete="off"
                value={header.value ?? ""}
                // A typed value replaces the saved one; the sealed value is never shown.
                onChange={(e) => setHeader(index, { value: e.target.value, sealed: undefined })}
                placeholder={header.sealed ? "•••••••• saved" : "Value"}
                className="font-mono text-[11px] h-8 flex-1"
              />
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Remove header"
                onClick={() => onChange({ headers: headers.filter((_, i) => i !== index) })}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onChange({ headers: [...headers, { name: "", value: "" }] })}
          >
            <Plus size={14} className="mr-1" /> Add header
          </Button>
        </div>
        <p className="text-[10px] text-gray-400 mt-1">
          Values are stored encrypted and never shown again; type a new one to replace it.
        </p>
      </FormField>

      {method !== "GET" && method !== "DELETE" && (
        <FormField>
          <Label>Body (JSON)</Label>
          <Textarea
            value={(data.body as string) ?? ""}
            onChange={(e) => onChange({ body: e.target.value })}
            placeholder={'{\n  "email": "{{contact.email}}",\n  "plan": "{{event.plan}}",\n  "total": {{event.total}}\n}'}
            className="font-mono text-[10px] min-h-[120px]"
          />
          <p className="text-[10px] text-gray-400 mt-1">
            Merge tags: {"{{contact.*}}"}, {"{{event.*}}"}, {"{{steps.<id>.body.*}}"}. Inside quotes a value is text;
            outside, a JSON value.
          </p>
        </FormField>
      )}

      <FormField>
        <Label>Timeout (seconds)</Label>
        <Input
          type="number"
          min={1}
          max={HTTP_STEP_MAX_TIMEOUT_S}
          value={(data.timeoutSeconds as number | undefined) ?? HTTP_STEP_DEFAULT_TIMEOUT_S}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10);
            onChange({ timeoutSeconds: Number.isFinite(n) ? n : undefined });
          }}
          className="h-8 w-24"
        />
        <p className="text-[10px] text-gray-400 mt-1">
          A 2xx answer goes on; its status and body are this step&apos;s output ({"{{steps.<id>.status}}"}). Other answers
          fail the step; 5xx, 429 and timeouts are retried first.
        </p>
      </FormField>

      <OnErrorField
        type="http_request"
        value={data.onError}
        onChange={(onError) => onChange({ onError })}
      />

      <FormField>
        <Label>Node Label</Label>
        <Input
          value={(data.label as string) || ""}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="e.g. Notify CRM"
        />
      </FormField>
    </div>
  );
}

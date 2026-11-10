import React from "react";
import { X, Trash2, LogOut } from "lucide-react";
import { useAutomationStore } from "../store/automationStore";
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  FormField,
  Textarea,
} from "@senlo/ui";
import { STEP_META } from "./nodes/stepMeta";
import { TriggerConfig } from "./TriggerConfig";

interface Trigger {
  id: number;
  name: string;
}

interface Props {
  triggers?: Trigger[];
  /** Asks to delete a step; the canvas confirms first. */
  onDelete: (nodeId: string) => void;
}

export const SidePanel = ({ triggers = [], onDelete }: Props) => {
  const { selectedNodeId, nodes, updateNodeData, setSelectedNodeId } =
    useAutomationStore();

  const node = nodes.find((n) => n.id === selectedNodeId);

  if (!node) return null;

  const renderConfig = () => {
    switch (node.type) {
      case "trigger":
        return (
          <div className="space-y-4">
            <TriggerConfig data={node.data} onChange={(data) => updateNodeData(node.id, data)} />
            <FormField>
              <Label>Label</Label>
              <Input
                value={(node.data.label as string) || ""}
                onChange={(e) =>
                  updateNodeData(node.id, { label: e.target.value })
                }
                placeholder="e.g. Trial started"
              />
            </FormField>
          </div>
        );
      case "action":
        return (
          <div className="space-y-4">
            <FormField>
              <Label>Select Trigger (Campaign)</Label>
              <Select
                value={String(
                  node.data.triggerId || node.data.templateId || "",
                )}
                onValueChange={(val) =>
                  updateNodeData(node.id, { triggerId: val })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select trigger" />
                </SelectTrigger>
                <SelectContent>
                  {triggers.length > 0 ? (
                    triggers.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name}
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="none" disabled>
                      No triggers found
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-zinc-500 mt-1">
                Triggers contain both the email design and sender settings.
              </p>
            </FormField>
            <FormField>
              <Label>Node Label</Label>
              <Input
                value={(node.data.label as string) || ""}
                onChange={(e) =>
                  updateNodeData(node.id, { label: e.target.value })
                }
                placeholder="e.g. Welcome Email"
              />
            </FormField>
          </div>
        );
      case "delay":
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <FormField>
                <Label>Wait Duration</Label>
                <Input
                  type="number"
                  value={(node.data.duration as number) || 1}
                  onChange={(e) =>
                    updateNodeData(node.id, {
                      duration: parseInt(e.target.value) || 0,
                    })
                  }
                />
              </FormField>
              <FormField>
                <Label>Unit</Label>
                <Select
                  value={(node.data.unit as string) || "days"}
                  onValueChange={(val) =>
                    updateNodeData(node.id, { unit: val })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Unit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="minutes">Minutes</SelectItem>
                    <SelectItem value="hours">Hours</SelectItem>
                    <SelectItem value="days">Days</SelectItem>
                  </SelectContent>
                </Select>
              </FormField>
            </div>
          </div>
        );
      case "condition":
        return (
          <div className="space-y-4">
            <FormField>
              <Label>API Check URL</Label>
              <Input
                value={(node.data.url as string) || ""}
                onChange={(e) =>
                  updateNodeData(node.id, { url: e.target.value })
                }
                placeholder="https://api.example.com/check"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Senlo will send a POST request to this URL. Status 200 = YES,
                any other = NO.
              </p>
              <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-100">
                <p className="text-[9px] font-bold text-blue-700 uppercase mb-1">
                  Testing Tip
                </p>
                <p className="text-[10px] text-blue-600">
                  Use{" "}
                  <code className="bg-white px-1 py-0.5 rounded border border-blue-200">
                    /api/debug/check
                  </code>{" "}
                  to test. It returns YES if email contains "pass" or{" "}
                  <code className="bg-white px-1 py-0.5 rounded border border-blue-200">
                    test_check: true
                  </code>{" "}
                  in metadata.
                </p>
              </div>
            </FormField>
          </div>
        );
      case "update_contact":
        return (
          <div className="space-y-4">
            <FormField>
              <Label>Field Updates (JSON)</Label>
              <Textarea
                value={JSON.stringify(node.data.updates || {}, null, 2)}
                onChange={(e) => {
                  try {
                    const updates = JSON.parse(e.target.value);
                    updateNodeData(node.id, { updates });
                  } catch (err) {
                    // Ignore invalid JSON while typing
                  }
                }}
                placeholder='{ "tags": ["warmed"], "plan": "pro" }'
                className="font-mono text-[10px] min-h-[120px]"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Enter field/value pairs to update on the contact. Use "tags"
                array to append tags.
              </p>
            </FormField>
            <FormField>
              <Label>Node Label</Label>
              <Input
                value={(node.data.label as string) || ""}
                onChange={(e) =>
                  updateNodeData(node.id, { label: e.target.value })
                }
                placeholder="e.g. Mark as Warmed"
              />
            </FormField>
          </div>
        );
      case "exit":
        return (
          <div className="space-y-4 text-center py-8">
            <LogOut size={48} className="mx-auto text-red-200" />
            <p className="text-sm text-gray-500">
              This node explicitly ends the automation journey for the contact.
            </p>
          </div>
        );
      default:
        return <div>No configuration available for this node type.</div>;
    }
  };

  const meta = STEP_META[node.type ?? ""];
  const Icon = meta?.icon;

  return (
    <div className="w-80 border-l border-gray-200 bg-white h-full flex flex-col shadow-lg overflow-y-auto">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <div className="flex size-8 items-center justify-center rounded-lg border border-gray-200 bg-gray-50">
              <Icon size={16} strokeWidth={1.75} className={meta.tone} />
            </div>
          )}
          <h2 className="text-[15px] font-semibold text-gray-900">
            {meta?.kind ?? node.type}
          </h2>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSelectedNodeId(null)}
          className="h-8 w-8 text-gray-400 hover:text-gray-600"
        >
          <X size={18} />
        </Button>
      </div>
      <div className="p-4 flex-1">{renderConfig()}</div>
      <div className="p-4 border-t border-gray-100 flex flex-col gap-4 bg-gray-50">
        {node.type !== "trigger" && (
          <Button
            variant="outline"
            onClick={() => onDelete(node.id)}
            className="w-full text-red-600 border-red-100 hover:bg-red-50 hover:text-red-700 h-9 text-sm"
          >
            <Trash2 size={14} className="mr-2" />
            Delete step
          </Button>
        )}
        <div className="text-[10px] text-gray-400">Step ID: {node.id}</div>
      </div>

    </div>
  );
};

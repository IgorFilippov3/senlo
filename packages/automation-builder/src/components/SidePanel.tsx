import React from "react";
import { X, Mail, Zap, Clock, GitBranch, Trash2 } from "lucide-react";
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
} from "@senlo/ui";

interface Trigger {
  id: number;
  name: string;
}

interface Props {
  triggers?: Trigger[];
}

export const SidePanel = ({ triggers = [] }: Props) => {
  const {
    selectedNodeId,
    nodes,
    updateNodeData,
    setSelectedNodeId,
    deleteNode,
  } = useAutomationStore();

  const node = nodes.find((n) => n.id === selectedNodeId);

  if (!node) return null;

  const onDelete = () => {
    if (confirm("Are you sure you want to delete this node?")) {
      deleteNode(node.id);
    }
  };

  const renderConfig = () => {
    switch (node.type) {
      case "trigger":
        return (
          <div className="space-y-4">
            <FormField>
              <Label>Trigger Event</Label>
              <Select
                value={(node.data.event as string) || "contact_added"}
                onValueChange={(val) => updateNodeData(node.id, { event: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select event" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contact_added">Contact Added</SelectItem>
                  <SelectItem value="contact_updated">
                    Contact Updated
                  </SelectItem>
                  <SelectItem value="tag_added">Tag Added</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField>
              <Label>Label</Label>
              <Input
                value={(node.data.label as string) || ""}
                onChange={(e) =>
                  updateNodeData(node.id, { label: e.target.value })
                }
                placeholder="e.g. Added to list: Customers"
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
            </FormField>
          </div>
        );
      default:
        return <div>No configuration available for this node type.</div>;
    }
  };

  const getIcon = () => {
    switch (node.type) {
      case "trigger":
        return <Zap className="text-yellow-600" size={20} />;
      case "action":
        return <Mail className="text-blue-600" size={20} />;
      case "delay":
        return <Clock className="text-purple-600" size={20} />;
      case "condition":
        return <GitBranch className="text-green-600" size={20} />;
      default:
        return null;
    }
  };

  return (
    <div className="w-80 border-l border-gray-200 bg-white h-full flex flex-col shadow-lg overflow-y-auto">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
        <div className="flex items-center gap-2">
          {getIcon()}
          <h2 className="font-bold text-gray-900 capitalize">
            {node.type} Node
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
        <Button
          variant="outline"
          onClick={onDelete}
          className="w-full text-red-600 border-red-100 hover:bg-red-50 hover:text-red-700 h-9 text-xs font-bold uppercase tracking-wider"
        >
          <Trash2 size={14} className="mr-2" />
          Delete Node
        </Button>
        <div className="text-[10px] text-gray-400">Node ID: {node.id}</div>
      </div>
    </div>
  );
};

import React, { useState } from "react";
import {
  X,
  Mail,
  Zap,
  Clock,
  GitBranch,
  Trash2,
  LogOut,
  UserCog,
} from "lucide-react";
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
  Dialog,
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
  const [isDeleting, setIsDeleting] = useState(false);

  const node = nodes.find((n) => n.id === selectedNodeId);

  if (!node) return null;

  const onDelete = () => {
    deleteNode(node.id);
    setIsDeleting(false);
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
                  <SelectItem value="order_created">Order Created</SelectItem>
                  <SelectItem value="event_triggered">Custom Event</SelectItem>
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
      case "update_contact":
        return <UserCog className="text-orange-600" size={20} />;
      case "exit":
        return <LogOut className="text-red-600" size={20} />;
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
          onClick={() => setIsDeleting(true)}
          className="w-full text-red-600 border-red-100 hover:bg-red-50 hover:text-red-700 h-9 text-xs font-bold uppercase tracking-wider"
        >
          <Trash2 size={14} className="mr-2" />
          Delete Node
        </Button>
        <div className="text-[10px] text-gray-400">Node ID: {node.id}</div>
      </div>

      <Dialog
        isOpen={isDeleting}
        onClose={() => setIsDeleting(false)}
        title="Delete Node"
        description={`Are you sure you want to delete this ${node.type} node? This will also remove all connected lines.`}
        footer={
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsDeleting(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onDelete}>
              Delete Node
            </Button>
          </div>
        }
      >
        <p className="text-sm text-gray-500">
          Removing this node might break the workflow path for contacts
          currently in this automation.
        </p>
      </Dialog>
    </div>
  );
};

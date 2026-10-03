"use client";

import { Dialog, Textarea, Button } from "@senlo/ui";
import { Maximize2 } from "lucide-react";
import { MergeTagSelector } from "./merge-tag-selector";

interface TextareaExpandedModalProps {
  isOpen: boolean;
  onClose: () => void;
  value: string;
  onChange: (value: string) => void;
  title?: string;
  onInsertTag?: (tag: string) => void;
}

export const TextareaExpandedModal = ({
  isOpen,
  onClose,
  value,
  onChange,
  title = "Edit Text",
  onInsertTag,
}: TextareaExpandedModalProps) => {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      disableAnimation={true}
      title={title}
      className="max-w-2xl w-full"
    >
      <div className="space-y-4">
        {onInsertTag && (
          <div className="flex justify-end">
            <MergeTagSelector onSelect={onInsertTag} />
          </div>
        )}
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          minRows={15}
          className="w-full font-sans text-base p-4 border rounded-md shadow-inner focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
          autoFocus
        />
        <div className="flex justify-end">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </Dialog>
  );
};

export const ExpandButton = ({ onClick }: { onClick: () => void }) => (
  <div className="flex justify-end -mt-1">
    <Button
      variant="ghost"
      size="icon-sm"
      className="text-muted-foreground hover:text-foreground"
      onClick={(e) => {
        e.preventDefault();
        onClick();
      }}
      title="Expand editor"
    >
      <Maximize2 size={14} />
    </Button>
  </div>
);

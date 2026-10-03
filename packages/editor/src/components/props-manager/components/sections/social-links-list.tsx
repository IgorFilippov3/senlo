"use client";

import { Button, Input, FormField } from "@senlo/ui";
import { ArrowUp, ArrowDown, Trash2 } from "lucide-react";
import { SOCIAL_LABELS } from "./defaults/socials";

interface SocialLink {
  type: "facebook" | "twitter" | "instagram" | "youtube" | "discord" | "github" | "reddit";
  url: string;
  icon: string;
}

interface SocialLinksListProps {
  links: SocialLink[];
  onUpdateLink: (index: number, field: keyof SocialLink, value: string) => void;
  onDelete: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
}

export const SocialLinksList = ({ 
  links, 
  onUpdateLink, 
  onDelete,
  onMoveUp, 
  onMoveDown 
}: SocialLinksListProps) => {
  return (
    <div className="space-y-4">
      <label className="text-sm font-medium">Social Links</label>

      {links.length === 0 ? (
        <div className="text-center py-6 text-gray-500 text-sm">
          No social links configured
        </div>
      ) : (
        <div className="space-y-6">
          {links.map((link, index) => (
            <div key={index} className="border border-gray-200 rounded-md p-4 bg-gray-50">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-sm">
                  {SOCIAL_LABELS[link.type]}
                </h4>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onMoveUp(index)}
                    disabled={index === 0}
                  >
                    <ArrowUp size={14} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onMoveDown(index)}
                    disabled={index === links.length - 1}
                  >
                    <ArrowDown size={14} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => onDelete(index)}
                    disabled={links.length <= 1}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                <FormField label="Link URL">
                  <Input
                    value={link.url || ""}
                    onChange={(e) => onUpdateLink(index, "url", e.target.value)}
                    placeholder="https://facebook.com/yourpage"
                  />
                </FormField>

                <FormField label="Icon URL">
                  <Input
                    value={link.icon || ""}
                    onChange={(e) => onUpdateLink(index, "icon", e.target.value)}
                    placeholder="https://example.com/icon.png (leave empty for default)"
                  />
                </FormField>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
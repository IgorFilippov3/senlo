"use client";

import { Button, FormField, Textarea } from "@senlo/ui";
import { validateHTML } from "@senlo/core";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import { MergeTagSelector } from "../merge-tag-selector";
import { HTMLValidationMessage } from "./html-validation-message";

export interface ProductLineItem {
  left: string;
  right: string;
}

interface ProductLineItemsProps {
  items: ProductLineItem[];
  onChange: (items: ProductLineItem[]) => void;
}

/**
 * The lines of a product line block.
 *
 * The block used to hold a single label/value pair, which is why a card with
 * four rows in it had to be four blocks - and four separate frames. It is a
 * list now, so one block draws the whole card.
 */
export const ProductLineItems = ({ items, onChange }: ProductLineItemsProps) => {
  const update = (index: number, field: keyof ProductLineItem, value: string) => {
    onChange(
      items.map((item, i) => (i === index ? { ...item, [field]: value } : item)),
    );
  };

  const append = (index: number, field: keyof ProductLineItem, tag: string) => {
    update(index, field, `${items[index]?.[field] ?? ""}${tag}`);
  };

  const remove = (index: number) => {
    onChange(items.filter((_, i) => i !== index));
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;

    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const add = () => onChange([...items, { left: "", right: "" }]);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={index}
            className="border border-gray-200 rounded-md p-3 bg-gray-50 space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-500">
                Line {index + 1}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  className="p-1 h-7 w-7"
                  title="Move up"
                >
                  <ArrowUp size={14} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => move(index, 1)}
                  disabled={index === items.length - 1}
                  className="p-1 h-7 w-7"
                  title="Move down"
                >
                  <ArrowDown size={14} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(index)}
                  disabled={items.length <= 1}
                  className="p-1 h-7 w-7 text-red-600 hover:text-red-700"
                  title="Remove line"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>

            <FormField
              label="Left"
              headerAction={
                <MergeTagSelector
                  onSelect={(tag) => append(index, "left", tag)}
                />
              }
            >
              <Textarea
                value={item.left || ""}
                onChange={(e) => update(index, "left", e.target.value)}
                placeholder="Product name"
                minRows={1}
              />
              <HTMLValidationMessage errors={validateHTML(item.left || "")} />
            </FormField>

            <FormField
              label="Right"
              headerAction={
                <MergeTagSelector
                  onSelect={(tag) => append(index, "right", tag)}
                />
              }
            >
              <Textarea
                value={item.right || ""}
                onChange={(e) => update(index, "right", e.target.value)}
                placeholder="$99.99"
                minRows={1}
              />
              <HTMLValidationMessage errors={validateHTML(item.right || "")} />
            </FormField>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        onClick={add}
      >
        <Plus size={16} />
        Add Line
      </Button>
    </div>
  );
};

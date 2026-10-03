"use client";

import {
  Button,
  ColorPicker,
  FormField,
  FormGrid,
  Input,
  ToggleGroup,
} from "@senlo/ui";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Bold,
  Plus,
  Trash2,
  Type,
} from "lucide-react";

import {
  MIN_COLUMN_WIDTH,
  normalizeWidths,
  resizeColumns,
} from "../../../../state/columns/resize-columns";

export interface TableColumn {
  key: string;
  label?: string;
  width?: number;
  align?: "left" | "center" | "right";
  style?: {
    color?: string;
    fontSize?: number;
    lineHeight?: number;
    fontWeight?: "normal" | "bold";
    fontFamily?: string;
  };
}

interface TableColumnsProps {
  columns: TableColumn[];
  /** False when the rows are typed here, where a column's key means nothing. */
  showKeys: boolean;
  onChange: (columns: TableColumn[]) => void;
}

const weightOptions = [
  { value: "normal", icon: <Type size={14} />, label: "Regular" },
  { value: "bold", icon: <Bold size={14} />, label: "Bold" },
];

const alignOptions = [
  { value: "left", icon: <AlignLeft size={14} />, label: "Left" },
  { value: "center", icon: <AlignCenter size={14} />, label: "Center" },
  { value: "right", icon: <AlignRight size={14} />, label: "Right" },
];

/**
 * The columns of a table, defined once.
 *
 * This is the whole reason the block exists: built out of a row's columns, a
 * table's widths live on the header row and again on the body row with nothing
 * keeping them level. Here there is one list, and the header is a label on the
 * column rather than a row of its own.
 *
 * The widths use the same boundary model as a row's columns - editing one moves
 * its boundary with the next, so the table always adds up to 100 and no edit can
 * leave it rendering wrong. Same function, same behaviour, learned once.
 */
export const TableColumns = ({ columns, showKeys, onChange }: TableColumnsProps) => {
  const widths = normalizeWidths(columns.map((c) => c.width ?? 0));

  const update = (index: number, patch: Partial<TableColumn>) => {
    onChange(columns.map((c, i) => (i === index ? { ...c, ...patch } : c)));
  };

  const setWidth = (index: number, next: number) => {
    const resized = resizeColumns(widths, index, next);
    onChange(columns.map((c, i) => ({ ...c, width: resized[i] })));
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= columns.length) return;

    const next = [...columns];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const remove = (index: number) => {
    if (columns.length <= 1) return;

    // The removed column's share goes back to the table rather than leaving it
    // short of 100.
    const kept = columns.filter((_, i) => i !== index);
    const rebalanced = normalizeWidths(kept.map((c) => c.width ?? 0));
    onChange(kept.map((c, i) => ({ ...c, width: rebalanced[i] })));
  };

  const add = () => {
    const next = [...columns, { key: "", label: "", align: "left" as const }];
    const even = normalizeWidths(next.map(() => 1));
    onChange(next.map((c, i) => ({ ...c, width: even[i] })));
  };

  return (
    <div className="space-y-3">
      {columns.map((column, index) => (
        <div
          key={index}
          className="border border-zinc-200 rounded-md p-3 bg-zinc-50 space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500">
              Column {index + 1}
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
                disabled={index === columns.length - 1}
                title="Move down"
              >
                <ArrowDown size={14} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => remove(index)}
                disabled={columns.length <= 1}
                className="text-red-600"
                title="Remove column"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          </div>

          <FormField label="Header">
            <Input
              value={column.label ?? ""}
              placeholder="Description"
              onChange={(e) => update(index, { label: e.target.value })}
            />
          </FormField>

          {showKeys && (
            <FormField
              label="Field"
              hint="The name of this column's field in each row of the data."
            >
              <Input
                value={column.key ?? ""}
                placeholder="description"
                onChange={(e) => update(index, { key: e.target.value })}
              />
            </FormField>
          )}

          <FormGrid cols={2}>
            <FormField label="Align">
              <ToggleGroup
                value={column.align || "left"}
                options={alignOptions}
                onChange={(val) => update(index, { align: val as any })}
              />
            </FormField>
            <FormField label="Width">
              <div className="flex items-center gap-1 px-2 py-1 bg-white border border-zinc-200 rounded">
                <input
                  type="number"
                  min={MIN_COLUMN_WIDTH}
                  max={100 - MIN_COLUMN_WIDTH}
                  className="w-full border-none outline-none text-xs text-right bg-transparent"
                  value={widths[index] ?? 0}
                  onChange={(e) => setWidth(index, Number(e.target.value))}
                />
                <span className="text-xs text-zinc-400">%</span>
              </div>
            </FormField>
          </FormGrid>

          <FormGrid cols={2}>
            <FormField label="Text Color">
              <ColorPicker
                value={column.style?.color}
                onChange={(value) =>
                  update(index, { style: { ...column.style, color: value } })
                }
                defaultValue="#111827"
              />
            </FormField>
            <FormField label="Weight">
              <ToggleGroup
                value={column.style?.fontWeight || "normal"}
                options={weightOptions}
                onChange={(value) =>
                  update(index, {
                    style: { ...column.style, fontWeight: value as any },
                  })
                }
              />
            </FormField>
          </FormGrid>
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={add}
        className="w-full"
      >
        <Plus size={14} className="mr-1" />
        Add column
      </Button>
    </div>
  );
};

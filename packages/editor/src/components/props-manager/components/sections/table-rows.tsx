"use client";

import { Button, Input } from "@senlo/ui";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";

import type { TableColumn } from "./table-columns";

interface TableRowsProps {
  columns: TableColumn[];
  rows: string[][];
  onChange: (rows: string[][]) => void;
}

/**
 * Rows typed in the panel, for a table with no variable behind it - a
 * comparison, a spec list, a plan breakdown. Cells are positional to the
 * columns, and a row shorter than the column list is padded rather than letting
 * its cells shift into the wrong columns.
 */
export const TableRows = ({ columns, rows, onChange }: TableRowsProps) => {
  const pad = (row: string[]) => columns.map((_, i) => row[i] ?? "");

  const update = (rowIndex: number, cellIndex: number, value: string) => {
    onChange(
      rows.map((row, i) =>
        i === rowIndex
          ? pad(row).map((cell, c) => (c === cellIndex ? value : cell))
          : row,
      ),
    );
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;

    const next = [...rows];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="space-y-3">
      {rows.map((row, rowIndex) => (
        <div
          key={rowIndex}
          className="border border-zinc-200 rounded-md p-3 bg-zinc-50 space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500">
              Row {rowIndex + 1}
            </span>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => move(rowIndex, -1)}
                disabled={rowIndex === 0}
                title="Move up"
              >
                <ArrowUp size={14} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => move(rowIndex, 1)}
                disabled={rowIndex === rows.length - 1}
                title="Move down"
              >
                <ArrowDown size={14} />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={() => onChange(rows.filter((_, i) => i !== rowIndex))}
                className="text-red-600"
                title="Remove row"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          </div>

          {columns.map((column, cellIndex) => (
            <Input
              key={cellIndex}
              value={pad(row)[cellIndex]}
              placeholder={column.label || column.key || `Column ${cellIndex + 1}`}
              onChange={(e) => update(rowIndex, cellIndex, e.target.value)}
            />
          ))}
        </div>
      ))}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => onChange([...rows, columns.map(() => "")])}
        className="w-full"
      >
        <Plus size={14} className="mr-1" />
        Add row
      </Button>
    </div>
  );
};

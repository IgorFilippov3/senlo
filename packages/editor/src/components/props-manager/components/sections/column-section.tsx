"use client";

import React from "react";
import { FormField, FormSection, PaddingControl } from "@senlo/ui";
import { Controller } from "react-hook-form";
import type { ColumnBlock, RowId } from "@senlo/core";

import { useColumnForm } from "../../../../hooks/use-column-form";
import { BoxSection } from "./box-section";
import { DEFAULT_PADDING } from "./defaults/common";

interface ColumnSectionProps {
  rowId: RowId;
  column: ColumnBlock;
}

/**
 * The card a column draws around its blocks: what turns a column of a label,
 * a number and a delta into a KPI tile without hand-written HTML.
 */
export const ColumnSection = ({ rowId, column }: ColumnSectionProps) => {
  const { control } = useColumnForm({
    rowId,
    columnId: column.id,
    settings: column.settings,
  });

  return (
    <FormSection title="Column Settings">
      <FormField hint="The space between the column's edge and its blocks, inside the background.">
        <Controller
          name="padding"
          control={control}
          render={({ field }) => (
            <PaddingControl
              title="Inner spacing"
              value={field.value ?? DEFAULT_PADDING}
              onChange={field.onChange}
            />
          )}
        />
      </FormField>

      <BoxSection
        control={control}
        backgroundHint="Leave it unset for a column that shows the row behind it."
        marginHint="The gap around the column, outside its background. Use it to space cards in one row apart; on a phone the columns stack and it becomes the gap between them."
      />
    </FormSection>
  );
};

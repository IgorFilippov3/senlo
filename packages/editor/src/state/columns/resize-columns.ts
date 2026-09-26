/**
 * @fileoverview Moving the boundary between two columns.
 *
 * A width is not a property of one column, it is a property of how the row is
 * divided. So the control does not set a number, it moves a boundary: what one
 * column gains, its neighbour gives up. Three things follow, and all three are
 * why the model was chosen:
 *
 *   - the widths always add up to 100, by construction, so nothing ever has to
 *     be normalised after the fact and no edit can leave a row rendering wrong;
 *   - only two columns move per edit, so a four-column row stays predictable;
 *   - it is exactly what a drag handle between two columns does, so handles can
 *     be added later without the behaviour changing under anyone.
 */

/**
 * The narrowest a column may be dragged. A column at a few percent is unusable
 * on a desktop, collapses in Outlook, and is not a layout anyone means.
 */
export const MIN_COLUMN_WIDTH = 10;

/**
 * Whole percents that add up to 100.
 *
 * Rows created before this control existed carry thirds as `33.33 / 33.33 /
 * 33.34`, which no numeric field should ask anyone to type. They are rounded on
 * the way in - largest remainder, so the hundred is never lost to rounding -
 * and the document itself is only rewritten when an author actually edits that
 * row.
 */
export function normalizeWidths(widths: number[]): number[] {
  const count = widths.length;
  if (count === 0) return [];

  const safe = widths.map((w) => (Number.isFinite(w) && w > 0 ? w : 0));
  const total = safe.reduce((sum, w) => sum + w, 0);

  // A row whose widths are all missing or nonsense gets an even split rather
  // than a division by zero.
  const scaled =
    total > 0
      ? safe.map((w) => (w * 100) / total)
      : safe.map(() => 100 / count);

  const floored = scaled.map(Math.floor);
  let remainder = 100 - floored.reduce((sum, w) => sum + w, 0);

  // The remainder goes to the columns that lost the most to flooring, biggest
  // first. Ties go to the earlier column, which keeps the result stable.
  const order = scaled
    .map((w, i) => ({ i, fraction: w - Math.floor(w) }))
    .sort((a, b) => b.fraction - a.fraction || a.i - b.i);

  const result = [...floored];
  for (const { i } of order) {
    if (remainder <= 0) break;
    result[i] += 1;
    remainder -= 1;
  }

  return result;
}

/**
 * Moves the boundary that `index` owns, and returns the new widths.
 *
 * Every column but the last owns the boundary to its right; the last one owns
 * the boundary to its left, so that dragging the rightmost column does
 * something rather than nothing. The pair's combined width never changes, which
 * is what keeps the row at 100 without a normalising pass.
 *
 * Anything it cannot act on - a single column, an index out of range, a value
 * that is not a number - comes back as the normalised widths rather than
 * throwing or guessing.
 */
export function resizeColumns(
  widths: number[],
  index: number,
  next: number,
  min: number = MIN_COLUMN_WIDTH,
): number[] {
  const current = normalizeWidths(widths);

  if (current.length < 2) return current;
  if (index < 0 || index >= current.length) return current;
  if (!Number.isFinite(next)) return current;

  const partner = index === current.length - 1 ? index - 1 : index + 1;
  const pairTotal = current[index] + current[partner];

  // With a floor of 10 and a pair that only adds up to 15, there is no split
  // that satisfies both sides; the pair is left as it is rather than forced.
  if (pairTotal < min * 2) return current;

  const clamped = Math.min(Math.max(Math.round(next), min), pairTotal - min);

  const result = [...current];
  result[index] = clamped;
  result[partner] = pairTotal - clamped;

  return result;
}

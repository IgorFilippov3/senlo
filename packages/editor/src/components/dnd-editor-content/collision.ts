import {
  pointerWithin,
  rectIntersection,
  type Collision,
  type CollisionDetection,
} from "@dnd-kit/core";

/**
 * Droppables that mark a position between two things. They sit inside a
 * container (a block's zones inside its column, a row's inside the canvas) and
 * always win over it: the container is only the fallback for space no zone
 * covers.
 */
const POSITION_ZONES = new Set(["block-drop-zone", "row-drop-zone"]);

const typeOf = (collision: Collision): string | undefined =>
  collision.data?.droppableContainer?.data?.current?.type;

/**
 * Where a drop lands is where the pointer is.
 *
 * dnd-kit's default compares areas: the target is whichever droppable the
 * dragged card overlaps most. The card is a sidebar tile over a hundred pixels
 * square, a block's zone is half a line of text, and the column around them is
 * the size of the card or bigger - so the column won nearly every time and the
 * zones under the pointer never lit up. Worse, the card reaches above the
 * pointer, so near the top of a column the winner was often a zone in the row
 * above it.
 *
 * Under the pointer a zone nested in a column is hit along with the column, so
 * zones are preferred when there are any. Away from every droppable - a gap
 * between rows, the margin outside the email - the old overlap rule still
 * applies, so a drop released just off a target is not lost.
 */
export const pointerFirstCollision: CollisionDetection = (args) => {
  const hits = pointerWithin(args);

  if (hits.length > 0) {
    const zones = hits.filter((hit) => POSITION_ZONES.has(typeOf(hit) ?? ""));
    return zones.length > 0 ? zones : hits;
  }

  return rectIntersection(args);
};

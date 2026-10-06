import { describe, expect, it } from "vitest";

import { pointerFirstCollision } from "../collision";

const rect = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  width,
  height,
  right: left + width,
  bottom: top + height,
});

const droppable = (id: string, type: string) =>
  ({ id, key: id, data: { current: { type } }, disabled: false }) as any;

/**
 * A KPI column 0-200 wide and 0-120 tall holding one block at 20-60, whose
 * zones split it at 40 - the shape that lost every drop to the column.
 */
const scene = (pointer: { x: number; y: number } | null) => {
  const rects = new Map<string, any>([
    ["col", rect(0, 0, 200, 120)],
    ["before-b", rect(0, 20, 200, 20)],
    ["after-b", rect(0, 40, 200, 20)],
  ]);

  return pointerFirstCollision({
    active: { id: "drag", data: { current: { type: "content" } } } as any,
    // The dragged card: much bigger than a zone, as the sidebar tile is.
    collisionRect: rect(0, 0, 160, 160),
    droppableRects: rects,
    droppableContainers: [
      droppable("col", "column"),
      droppable("before-b", "block-drop-zone"),
      droppable("after-b", "block-drop-zone"),
    ],
    pointerCoordinates: pointer,
  });
};

describe("pointerFirstCollision", () => {
  it("picks the zone under the pointer over the column around it", () => {
    expect(scene({ x: 100, y: 50 }).map((c) => c.id)).toEqual(["after-b"]);
    expect(scene({ x: 100, y: 25 }).map((c) => c.id)).toEqual(["before-b"]);
  });

  it("falls back to the column where no zone is", () => {
    expect(scene({ x: 100, y: 100 }).map((c) => c.id)).toEqual(["col"]);
  });

  it("uses overlap when the pointer is over nothing", () => {
    const hits = scene({ x: 500, y: 500 });
    expect(hits[0].id).toBe("col");
  });
});

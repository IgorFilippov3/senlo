"use client";

import type { ComponentType } from "react";
import {
  AlignLeft,
  Heading,
  Image,
  List,
  Minus,
  MousePointerClick,
  Package,
  Share2,
  SquareSplitVertical,
} from "lucide-react";
import { BLOCK_REGISTRY, type ContentBlockType } from "@senlo/core";

import { HeadingSection } from "../components/props-manager/components/sections/heading-section";
import { ParagraphSection } from "../components/props-manager/components/sections/paragraph-section";
import { ButtonSection } from "../components/props-manager/components/sections/button-section";
import { ImageSection } from "../components/props-manager/components/sections/image-section";
import { SpacerSection } from "../components/props-manager/components/sections/spacer-section";
import { ListSection } from "../components/props-manager/components/sections/list-section";
import { DividerSection } from "../components/props-manager/components/sections/divider-section";
import { ProductLineSection } from "../components/props-manager/components/sections/product-line-section";
import { SocialsSection } from "../components/props-manager/components/sections/socials-section";

/**
 * The editor's half of the block registry: the parts that need React, and so
 * cannot live in `@senlo/core` next to the rendering and the schema. Everything
 * else about a block - its label, defaults, validation and markup - comes from
 * the core definition, which this looks up by the same key.
 */
export interface EditorBlockDefinition {
  icon: ComponentType<{ size?: number }>;
  PropsSection: ComponentType<{ block: any }>;
}

export const EDITOR_BLOCK_REGISTRY: Record<
  ContentBlockType,
  EditorBlockDefinition
> = {
  heading: { icon: Heading, PropsSection: HeadingSection },
  paragraph: { icon: AlignLeft, PropsSection: ParagraphSection },
  image: { icon: Image, PropsSection: ImageSection },
  button: { icon: MousePointerClick, PropsSection: ButtonSection },
  spacer: { icon: Minus, PropsSection: SpacerSection },
  list: { icon: List, PropsSection: ListSection },
  divider: { icon: SquareSplitVertical, PropsSection: DividerSection },
  "product-line": { icon: Package, PropsSection: ProductLineSection },
  socials: { icon: Share2, PropsSection: SocialsSection },
};

export function getEditorBlockDefinition(
  type: ContentBlockType,
): EditorBlockDefinition | undefined {
  return EDITOR_BLOCK_REGISTRY[type];
}

/** Label for a block type, taken from the core definition. */
export function getBlockLabel(type: ContentBlockType): string {
  return BLOCK_REGISTRY[type]?.label ?? type;
}

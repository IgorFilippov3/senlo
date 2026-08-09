"use client";

import styles from "./block-view.module.css";
import { ContentBlock, replaceMergeTags, evaluateCondition } from "@senlo/core";
import { useEditorStore } from "../../../../state/editor.store";
import { cn } from "@senlo/ui";
import { useDraggable } from "@dnd-kit/core";
import { BlockDropZones } from "../block-drop-zones/block-drop-zones";
import { BlockViewMenu } from "../block-view-menu/block-view-menu";
import type { JSX } from "react";
import { GitBranch } from "lucide-react";
import {
  DEFAULT_BUTTON_BG_COLOR,
  DEFAULT_BUTTON_COLOR,
  DEFAULT_BUTTON_FONT_SIZE,
  DEFAULT_BUTTON_FONT_WEIGHT,
  DEFAULT_BUTTON_BORDER_RADIUS,
  DEFAULT_BUTTON_PADDING,
  DEFAULT_BUTTON_BORDER,
} from "../../../props-manager/components/sections/defaults/button";
import {
  DEFAULT_IMAGE_ALIGN,
  DEFAULT_IMAGE_BORDER_RADIUS,
  DEFAULT_IMAGE_PADDING,
  DEFAULT_IMAGE_BORDER,
} from "../../../props-manager/components/sections/defaults/image";
import {
  DEFAULT_LIST_FONT_SIZE,
  DEFAULT_LIST_LINE_HEIGHT,
  DEFAULT_LIST_FONT_WEIGHT,
  DEFAULT_LIST_PADDING,
} from "../../../props-manager/components/sections/defaults/list";
import {
  DEFAULT_DIVIDER_COLOR,
  DEFAULT_DIVIDER_WIDTH,
  DEFAULT_DIVIDER_ALIGN,
  DEFAULT_DIVIDER_BORDER_WIDTH,
  DEFAULT_DIVIDER_BORDER_STYLE,
  DEFAULT_DIVIDER_PADDING,
} from "../../../props-manager/components/sections/defaults/divider";
import {
  DEFAULT_PRODUCT_LINE_LEFT_TEXT,
  DEFAULT_PRODUCT_LINE_RIGHT_TEXT,
  DEFAULT_PRODUCT_LINE_LEFT_STYLE,
  DEFAULT_PRODUCT_LINE_RIGHT_STYLE,
  DEFAULT_PRODUCT_LINE_RIGHT_WIDTH,
  DEFAULT_PRODUCT_LINE_PADDING,
} from "../../../props-manager/components/sections/defaults/product-line";

interface BlockViewProps {
  block: ContentBlock;
  columnId: string;
  rowId: string;
}

export const BlockView = ({ block, columnId, rowId }: BlockViewProps) => {
  const selection = useEditorStore((s) => s.selection);
  const select = useEditorStore((s) => s.select);
  const isDragActive = useEditorStore((s) => s.isDragActive);
  const activeDragType = useEditorStore((s) => s.activeDragType);
  const previewMode = useEditorStore((s) => s.previewMode);
  const previewContact = useEditorStore((s) => s.previewContact);

  // Evaluate condition in preview mode
  if (previewMode && block.condition) {
    const isVisible = evaluateCondition(block.condition, {
      responsiveStyles: [],
      options: {
        data: {
          contact: previewContact || {},
          custom: previewContact || {},
          workspace: { name: "Sample Workspace" },
          trigger: { name: "Sample Trigger" },
          unsubscribeUrl: "https://senlo.io/unsubscribe/sample-token",
        },
      },
    });

    if (!isVisible) {
      return null;
    }
  }

  const renderText = (text: string) => {
    const processedText = previewMode
      ? replaceMergeTags(text, {
          contact: previewContact || {},
          custom: previewContact || {}, // Support custom variables in canvas preview
          workspace: { name: "Sample Workspace" },
          trigger: { name: "Sample Trigger" },
          unsubscribeUrl: "https://senlo.io/unsubscribe/sample-token",
        })
      : text;

    return <span dangerouslySetInnerHTML={{ __html: processedText }} />;
  };

  const isSelected = selection?.kind === "block" && selection.id === block.id;

  const getBlockLabel = (block: ContentBlock): string => {
    switch (block.type) {
      case "heading":
        return `Heading: ${block.data.text.slice(0, 20)}...`;
      case "paragraph":
        return `Paragraph: ${block.data.text.slice(0, 20)}...`;
      case "button":
        return `Button: ${block.data.text}`;
      case "image":
        return "Image";
      case "list":
        return `List (${block.data.items.length} items)`;
      case "divider":
        return "Divider";
      case "spacer":
        return `Spacer (${block.data.height}px)`;
      case "product-line":
        return `Product Line: ${block.data.leftText} - ${block.data.rightText}`;
      default:
        return `Block: ${(block as any).type}`;
    }
  };

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `block-${block.id}`,
    data: {
      type: "block",
      data: {
        blockId: block.id,
        sourceColumnId: columnId,
        sourceRowId: rowId,
        blockType: block.type,
        blockData: block,
      },
      label: getBlockLabel(block),
    },
  });

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    select({ kind: "block", id: block.id });
  };

  const blockClassName = cn(
    styles.block,
    isSelected && styles.selected,
    isDragging && styles.dragging,
    block.type === "heading" && styles.headingBlock,
    block.type === "paragraph" && styles.paragraphBlock,
    block.type === "image" && styles.imageBlock,
    block.type === "button" && styles.buttonBlock,
    block.type === "spacer" && styles.spacerBlock,
    block.type === "list" && styles.listBlock,
    block.type === "divider" && styles.dividerBlock,
    block.type === "product-line" && styles.productLineBlock,
  );

  const commonProps = {
    ref: setNodeRef,
    className: blockClassName,
    onClick: handleClick,
    style: { opacity: isDragging ? 0.3 : 1 },
    ...listeners,
    ...attributes,
  };

  const renderBlockContent = () => {
    switch (block.type) {
      case "heading": {
        const level = block.data.level || 2;
        const HeadingTag = `h${level}` as keyof JSX.IntrinsicElements;
        return (
          <div {...commonProps}>
            <HeadingTag
              className={styles.heading}
              style={{
                textAlign: block.data.align || "left",
                color: block.data.color,
                fontSize:
                  block.data.fontSize && !isNaN(block.data.fontSize)
                    ? `${block.data.fontSize}px`
                    : undefined,
                lineHeight:
                  block.data.lineHeight && !isNaN(block.data.lineHeight)
                    ? block.data.lineHeight
                    : undefined,
                fontWeight: block.data.fontWeight,
                textTransform: block.data.textTransform,
                letterSpacing:
                  block.data.letterSpacing !== undefined
                    ? `${block.data.letterSpacing}px`
                    : undefined,
                paddingTop:
                  block.data.padding?.top !== undefined
                    ? `${block.data.padding.top}px`
                    : "10px",
                paddingRight:
                  block.data.padding?.right !== undefined
                    ? `${block.data.padding.right}px`
                    : "10px",
                paddingBottom:
                  block.data.padding?.bottom !== undefined
                    ? `${block.data.padding.bottom}px`
                    : "10px",
                paddingLeft:
                  block.data.padding?.left !== undefined
                    ? `${block.data.padding.left}px`
                    : "10px",
              }}
            >
              {block.data.href ? (
                <a
                  href={block.data.href}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "inherit", textDecoration: "none" }}
                  onClick={(e) => e.preventDefault()} // Prevent navigation in editor
                >
                  {renderText(block.data.text)}
                </a>
              ) : (
                renderText(block.data.text)
              )}
            </HeadingTag>
          </div>
        );
      }

      case "paragraph":
        return (
          <div {...commonProps}>
            <p
              className={styles.paragraph}
              style={{
                textAlign: block.data.align || "left",
                color: block.data.color,
                fontSize:
                  block.data.fontSize && !isNaN(block.data.fontSize)
                    ? `${block.data.fontSize}px`
                    : undefined,
                lineHeight:
                  block.data.lineHeight && !isNaN(block.data.lineHeight)
                    ? block.data.lineHeight
                    : undefined,
                fontWeight: block.data.fontWeight,
                textTransform: block.data.textTransform,
                letterSpacing:
                  block.data.letterSpacing !== undefined
                    ? `${block.data.letterSpacing}px`
                    : undefined,
                paddingTop:
                  block.data.padding?.top !== undefined
                    ? `${block.data.padding.top}px`
                    : "10px",
                paddingRight:
                  block.data.padding?.right !== undefined
                    ? `${block.data.padding.right}px`
                    : "10px",
                paddingBottom:
                  block.data.padding?.bottom !== undefined
                    ? `${block.data.padding.bottom}px`
                    : "10px",
                paddingLeft:
                  block.data.padding?.left !== undefined
                    ? `${block.data.padding.left}px`
                    : "10px",
              }}
            >
              {block.data.href ? (
                <a
                  href={block.data.href}
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "inherit", textDecoration: "none" }}
                  onClick={(e) => e.preventDefault()} // Prevent navigation in editor
                >
                  {renderText(block.data.text)}
                </a>
              ) : (
                renderText(block.data.text)
              )}
            </p>
          </div>
        );

      case "image": {
        const border = block.data.border || DEFAULT_IMAGE_BORDER;
        const imageStyles: React.CSSProperties = {
          width: block.data.fullWidth
            ? "100%"
            : block.data.width
              ? `${block.data.width}px`
              : "auto",
          height: "auto",
          maxWidth: "100%",
          display: "inline-block",
          borderRadius:
            block.data.borderRadius !== undefined
              ? `${block.data.borderRadius}px`
              : `${DEFAULT_IMAGE_BORDER_RADIUS}px`,
          borderStyle: border.style || DEFAULT_IMAGE_BORDER.style,
          borderColor: border.color || DEFAULT_IMAGE_BORDER.color,
        };

        if (border.width !== undefined && border.width > 0) {
          imageStyles.borderWidth = `${border.width}px`;
        } else {
          if (border.top !== undefined)
            imageStyles.borderTopWidth = `${border.top}px`;
          if (border.right !== undefined)
            imageStyles.borderRightWidth = `${border.right}px`;
          if (border.bottom !== undefined)
            imageStyles.borderBottomWidth = `${border.bottom}px`;
          if (border.left !== undefined)
            imageStyles.borderLeftWidth = `${border.left}px`;
        }

        return (
          <div
            {...commonProps}
            style={{
              ...commonProps.style,
              textAlign: block.data.align || DEFAULT_IMAGE_ALIGN,
              paddingTop:
                block.data.padding?.top !== undefined
                  ? `${block.data.padding.top}px`
                  : `${DEFAULT_IMAGE_PADDING.top}px`,
              paddingRight:
                block.data.padding?.right !== undefined
                  ? `${block.data.padding.right}px`
                  : `${DEFAULT_IMAGE_PADDING.right}px`,
              paddingBottom:
                block.data.padding?.bottom !== undefined
                  ? `${block.data.padding.bottom}px`
                  : `${DEFAULT_IMAGE_PADDING.bottom}px`,
              paddingLeft:
                block.data.padding?.left !== undefined
                  ? `${block.data.padding.left}px`
                  : `${DEFAULT_IMAGE_PADDING.left}px`,
            }}
          >
            <a
              href={block.data.href || "#"}
              target="_blank"
              rel="noreferrer"
              className={styles.imageLink}
              onClick={(e) => e.preventDefault()}
            >
              <img
                src={
                  block.data.src ||
                  "https://via.placeholder.com/300x150?text=No+Image"
                }
                alt={block.data.alt || ""}
                style={imageStyles}
              />
            </a>
          </div>
        );
      }

      case "button": {
        const padding = block.data.padding || DEFAULT_BUTTON_PADDING;
        const border = block.data.border || DEFAULT_BUTTON_BORDER;

        const buttonStyles: React.CSSProperties = {
          backgroundColor:
            block.data.backgroundColor || DEFAULT_BUTTON_BG_COLOR,
          color: block.data.color || DEFAULT_BUTTON_COLOR,
          fontSize: block.data.fontSize
            ? `${block.data.fontSize}px`
            : `${DEFAULT_BUTTON_FONT_SIZE}px`,
          fontWeight: block.data.fontWeight || DEFAULT_BUTTON_FONT_WEIGHT,
          borderRadius:
            block.data.borderRadius !== undefined
              ? `${block.data.borderRadius}px`
              : `${DEFAULT_BUTTON_BORDER_RADIUS}px`,
          letterSpacing:
            block.data.letterSpacing !== undefined
              ? `${block.data.letterSpacing}px`
              : undefined,
          textTransform: block.data.textTransform || "none",
          paddingTop:
            padding.top !== undefined
              ? `${padding.top}px`
              : `${DEFAULT_BUTTON_PADDING.top}px`,
          paddingRight:
            padding.right !== undefined
              ? `${padding.right}px`
              : `${DEFAULT_BUTTON_PADDING.right}px`,
          paddingBottom:
            padding.bottom !== undefined
              ? `${padding.bottom}px`
              : `${DEFAULT_BUTTON_PADDING.bottom}px`,
          paddingLeft:
            padding.left !== undefined
              ? `${padding.left}px`
              : `${DEFAULT_BUTTON_PADDING.left}px`,
          display: block.data.fullWidth ? "block" : "inline-block",
          width: block.data.fullWidth ? "100%" : "auto",
          boxSizing: "border-box",
          borderStyle: border.style || DEFAULT_BUTTON_BORDER.style,
          borderColor: border.color || DEFAULT_BUTTON_BORDER.color,
          boxShadow: block.data.shadow
            ? `${block.data.shadow.x || 0}px ${block.data.shadow.y || 0}px ${block.data.shadow.blur || 0}px ${block.data.shadow.color || "#000000"}`
            : "none",
        };

        // Handle borders
        if (border.width !== undefined && border.width > 0) {
          buttonStyles.borderWidth = `${border.width}px`;
        } else {
          if (border.top !== undefined)
            buttonStyles.borderTopWidth = `${border.top}px`;
          if (border.right !== undefined)
            buttonStyles.borderRightWidth = `${border.right}px`;
          if (border.bottom !== undefined)
            buttonStyles.borderBottomWidth = `${border.bottom}px`;
          if (border.left !== undefined)
            buttonStyles.borderLeftWidth = `${border.left}px`;

          // If we have individual borders but no global width, we need to ensure borderStyle and borderColor are applied
          // which they already are above via buttonStyles.borderStyle and buttonStyles.borderColor
        }

        return (
          <div
            {...commonProps}
            style={{
              ...commonProps.style,
              textAlign: block.data.align || "center",
            }}
          >
            <a
              href={block.data.href || "#"}
              className={styles.button}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.preventDefault()}
              style={buttonStyles}
            >
              {renderText(block.data.text)}
            </a>
          </div>
        );
      }

      case "spacer":
        return (
          <div
            {...commonProps}
            style={{
              ...commonProps.style,
              height: `${block.data.height}px`,
            }}
          />
        );

      case "list": {
        const ListTag = block.data.listType === "ordered" ? "ol" : "ul";
        return (
          <div {...commonProps}>
            <ListTag
              className={styles.list}
              style={{
                textAlign: block.data.align || "left",
                color: block.data.color,
                listStyleType:
                  block.data.listType === "ordered" ? "decimal" : "disc",
                fontSize: block.data.fontSize
                  ? `${block.data.fontSize}px`
                  : `${DEFAULT_LIST_FONT_SIZE}px`,
                lineHeight: block.data.lineHeight
                  ? block.data.lineHeight
                  : DEFAULT_LIST_LINE_HEIGHT,
                fontWeight: block.data.fontWeight || DEFAULT_LIST_FONT_WEIGHT,
                paddingTop:
                  block.data.padding?.top !== undefined
                    ? `${block.data.padding.top}px`
                    : `${DEFAULT_LIST_PADDING.top}px`,
                paddingRight:
                  block.data.padding?.right !== undefined
                    ? `${block.data.padding.right}px`
                    : `${DEFAULT_LIST_PADDING.right}px`,
                paddingBottom:
                  block.data.padding?.bottom !== undefined
                    ? `${block.data.padding.bottom}px`
                    : `${DEFAULT_LIST_PADDING.bottom}px`,
                paddingLeft:
                  block.data.padding?.left !== undefined
                    ? `${block.data.padding.left}px`
                    : `${DEFAULT_LIST_PADDING.left}px`,
              }}
            >
              {block.data.items.map((item: string, index: number) => (
                <li key={index}>{renderText(item)}</li>
              ))}
            </ListTag>
          </div>
        );
      }

      case "divider":
        return (
          <div
            {...commonProps}
            style={{
              ...commonProps.style,
              textAlign: block.data.align || DEFAULT_DIVIDER_ALIGN,
              paddingTop:
                block.data.padding?.top !== undefined
                  ? `${block.data.padding.top}px`
                  : `${DEFAULT_DIVIDER_PADDING.top}px`,
              paddingRight:
                block.data.padding?.right !== undefined
                  ? `${block.data.padding.right}px`
                  : `${DEFAULT_DIVIDER_PADDING.right}px`,
              paddingBottom:
                block.data.padding?.bottom !== undefined
                  ? `${block.data.padding.bottom}px`
                  : `${DEFAULT_DIVIDER_PADDING.bottom}px`,
              paddingLeft:
                block.data.padding?.left !== undefined
                  ? `${block.data.padding.left}px`
                  : `${DEFAULT_DIVIDER_PADDING.left}px`,
            }}
          >
            <div
              className={styles.divider}
              style={{
                width: `${block.data.width || DEFAULT_DIVIDER_WIDTH}%`,
                borderTopWidth: `${block.data.borderWidth || DEFAULT_DIVIDER_BORDER_WIDTH}px`,
                borderTopStyle:
                  block.data.borderStyle || DEFAULT_DIVIDER_BORDER_STYLE,
                borderTopColor: block.data.color || DEFAULT_DIVIDER_COLOR,
              }}
            />
          </div>
        );

      case "product-line":
        return (
          <div
            {...commonProps}
            style={{
              ...commonProps.style,
              paddingTop:
                block.data.padding?.top !== undefined
                  ? `${block.data.padding.top}px`
                  : `${DEFAULT_PRODUCT_LINE_PADDING.top}px`,
              paddingRight:
                block.data.padding?.right !== undefined
                  ? `${block.data.padding.right}px`
                  : `${DEFAULT_PRODUCT_LINE_PADDING.right}px`,
              paddingBottom:
                block.data.padding?.bottom !== undefined
                  ? `${block.data.padding.bottom}px`
                  : `${DEFAULT_PRODUCT_LINE_PADDING.bottom}px`,
              paddingLeft:
                block.data.padding?.left !== undefined
                  ? `${block.data.padding.left}px`
                  : `${DEFAULT_PRODUCT_LINE_PADDING.left}px`,
            }}
          >
            <div className={styles.productLine}>
              <table
                role="presentation"
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  borderSpacing: 0,
                }}
              >
                <tbody>
                  <tr>
                    <td
                      style={{
                        textAlign: "left",
                        fontFamily:
                          block.data.leftStyle?.fontFamily ||
                          DEFAULT_PRODUCT_LINE_LEFT_STYLE.fontFamily,
                        fontSize: block.data.leftStyle?.fontSize
                          ? `${block.data.leftStyle.fontSize}px`
                          : `${DEFAULT_PRODUCT_LINE_LEFT_STYLE.fontSize}px`,
                        lineHeight:
                          block.data.leftStyle?.lineHeight ||
                          DEFAULT_PRODUCT_LINE_LEFT_STYLE.lineHeight,
                        color:
                          block.data.leftStyle?.color ||
                          DEFAULT_PRODUCT_LINE_LEFT_STYLE.color,
                        fontWeight:
                          block.data.leftStyle?.fontWeight ||
                          DEFAULT_PRODUCT_LINE_LEFT_STYLE.fontWeight,
                        verticalAlign: "top",
                        padding: 0,
                      }}
                    >
                      {renderText(
                        block.data.leftText || DEFAULT_PRODUCT_LINE_LEFT_TEXT,
                      )}
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        width: `${block.data.rightWidth || DEFAULT_PRODUCT_LINE_RIGHT_WIDTH}px`,
                        fontFamily:
                          block.data.rightStyle?.fontFamily ||
                          DEFAULT_PRODUCT_LINE_RIGHT_STYLE.fontFamily,
                        fontSize: block.data.rightStyle?.fontSize
                          ? `${block.data.rightStyle.fontSize}px`
                          : `${DEFAULT_PRODUCT_LINE_RIGHT_STYLE.fontSize}px`,
                        lineHeight:
                          block.data.rightStyle?.lineHeight ||
                          DEFAULT_PRODUCT_LINE_RIGHT_STYLE.lineHeight,
                        color:
                          block.data.rightStyle?.color ||
                          DEFAULT_PRODUCT_LINE_RIGHT_STYLE.color,
                        fontWeight:
                          block.data.rightStyle?.fontWeight ||
                          DEFAULT_PRODUCT_LINE_RIGHT_STYLE.fontWeight,
                        whiteSpace: "nowrap",
                        verticalAlign: "top",
                        padding: 0,
                      }}
                    >
                      {renderText(
                        block.data.rightText || DEFAULT_PRODUCT_LINE_RIGHT_TEXT,
                      )}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );

      case "socials":
        return (
          <div
            {...commonProps}
            style={{
              ...commonProps.style,
              paddingTop:
                block.data.padding?.top !== undefined
                  ? `${block.data.padding.top}px`
                  : "10px",
              paddingRight:
                block.data.padding?.right !== undefined
                  ? `${block.data.padding.right}px`
                  : "0px",
              paddingBottom:
                block.data.padding?.bottom !== undefined
                  ? `${block.data.padding.bottom}px`
                  : "10px",
              paddingLeft:
                block.data.padding?.left !== undefined
                  ? `${block.data.padding.left}px`
                  : "0px",
            }}
          >
            <div
              style={{
                textAlign: block.data.align || "center",
                display: "flex",
                justifyContent:
                  block.data.align === "left"
                    ? "flex-start"
                    : block.data.align === "right"
                      ? "flex-end"
                      : "center",
                gap: `${block.data.spacing || 10}px`,
                flexWrap: "wrap",
              }}
            >
              {(block.data.links || []).map((link: any, index: number) => {
                const iconSize = block.data.size || 32;
                return (
                  <img
                    key={index}
                    src={link.icon || `/icons/${link.type}.png`}
                    alt={link.type}
                    style={{
                      width: `${iconSize}px`,
                      height: `${iconSize}px`,
                      borderRadius: "4px",
                      objectFit: "contain",
                    }}
                    title={`${link.type}: ${link.url}`}
                    onError={(e) => {
                      // Fallback to placeholder if image fails to load
                      const target = e.target as HTMLImageElement;
                      target.style.backgroundColor = "#3b82f6";
                      target.style.display = "flex";
                      target.style.alignItems = "center";
                      target.style.justifyContent = "center";
                      target.style.color = "white";
                      target.style.fontSize = "12px";
                      target.style.fontWeight = "bold";
                      target.textContent = link.type.charAt(0).toUpperCase();
                    }}
                  />
                );
              })}
            </div>
          </div>
        );

      default:
        return (
          <div
            {...commonProps}
            className={cn(commonProps.className, styles.unknown)}
          >
            Unsupported block type: {(block as any).type}
          </div>
        );
    }
  };

  return (
    <div style={{ position: "relative" }}>
      {block.condition && (
        <div
          className="absolute top-1 right-2 z-10 bg-blue-500 text-white p-1 rounded-full shadow-sm"
          title={`Condition: ${block.condition.variable} ${block.condition.operator} ${block.condition.value ?? ""}`}
        >
          <GitBranch size={10} />
        </div>
      )}
      {renderBlockContent()}
      {isDragActive &&
        (activeDragType === "block" || activeDragType === "content") && (
          <BlockDropZones blockId={block.id} columnId={columnId} />
        )}
      {isSelected && !isDragActive && (
        <BlockViewMenu blockId={block.id} columnId={columnId} />
      )}
    </div>
  );
};

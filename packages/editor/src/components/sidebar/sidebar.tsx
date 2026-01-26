"use client";

import styles from "./sidebar.module.css";

import { SidebarSection } from "./components/sidebar-section/sidebar-section";
import { RowsSection } from "./components/rows-section/rows-section";
import { AiSection } from "./components/ai-section/ai-section";
import { useEditorStore } from "../../state/editor.store";
import { cn, Tooltip } from "@senlo/ui";
import { ContentItem } from "./components/content-item/content-item";

export const Sidebar = () => {
  const activeTab = useEditorStore((s) => s.activeSidebarTab);
  const setActiveTab = useEditorStore((s) => s.setActiveSidebarTab);

  return (
    <aside className={styles.sidebar}>
      <div className={styles.tabs}>
        <button
          className={cn(styles.tab, activeTab === "rows" && styles.tabActive)}
          onClick={() => setActiveTab("rows")}
        >
          ROWS
        </button>
        <button
          className={cn(
            styles.tab,
            activeTab === "content" && styles.tabActive,
          )}
          onClick={() => setActiveTab("content")}
        >
          CONTENT
        </button>
        <Tooltip content="Experimental AI Features" delay={100} side="right">
          <button
            className={cn(styles.tab, activeTab === "ai" && styles.tabActive)}
            onClick={() => setActiveTab("ai")}
          >
            AI
          </button>
        </Tooltip>
      </div>

      {activeTab === "rows" && <RowsSection />}

      {activeTab === "content" && (
        <SidebarSection title="Content" variant="content">
          <ContentItem blockType="heading" label="Heading" />
          <ContentItem blockType="paragraph" label="Paragraph" />
          <ContentItem blockType="button" label="Button" />
          <ContentItem blockType="image" label="Image" />
          <ContentItem blockType="list" label="List" />
          <ContentItem blockType="divider" label="Divider" />
          <ContentItem blockType="spacer" label="Spacer" />
          <ContentItem blockType="product-line" label="Product Line" />
          <ContentItem blockType="socials" label="Socials" />
        </SidebarSection>
      )}

      {activeTab === "ai" && <AiSection />}
    </aside>
  );
};

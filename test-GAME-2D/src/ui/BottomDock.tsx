import React, { useEffect, useMemo, useState } from "react";

export type DockTab = {
  id: string;
  label: string;
  content: React.ReactNode;
  hidden?: boolean;
};

export function BottomDock(props: {
  tabs: DockTab[];
  defaultTabId?: string;
  expandedHeight?: number;
  collapsedHeight?: number;
  collapsible?: boolean;
  collapsedByDefault?: boolean;
  forcedTabId?: string | null;
}): React.ReactNode {
  const visibleTabs = useMemo(() => props.tabs.filter(t => !t.hidden), [props.tabs]);
  const defaultTabId = props.defaultTabId ?? visibleTabs[0]?.id ?? "tab";
  const collapsible = props.collapsible ?? true;
  const collapsedByDefault = props.collapsedByDefault ?? true;
  const [activeTabId, setActiveTabId] = useState<string | null>(
    collapsedByDefault && collapsible ? null : defaultTabId
  );

  useEffect(() => {
    if (activeTabId === null) return;
    if (visibleTabs.some(t => t.id === activeTabId)) return;
    setActiveTabId(defaultTabId);
  }, [activeTabId, defaultTabId, visibleTabs]);

  useEffect(() => {
    if (!props.forcedTabId) return;
    if (!visibleTabs.some(t => t.id === props.forcedTabId)) return;
    setActiveTabId(props.forcedTabId);
  }, [props.forcedTabId, visibleTabs]);

  const activeTab = activeTabId ? visibleTabs.find(t => t.id === activeTabId) : undefined;
  const expandedHeight = props.expandedHeight ?? 320;
  const collapsedHeight = props.collapsedHeight ?? 52;
  const isOpen = activeTabId !== null;

  return (
    <div
      style={{
        flex: `0 0 ${isOpen ? expandedHeight : collapsedHeight}px`,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        background: "rgba(12, 12, 18, 0.9)",
        border: "1px solid rgba(255,255,255,0.10)",
        borderRadius: 14,
        boxShadow: "0 18px 60px rgba(0,0,0,0.45)"
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 8,
          padding: "10px 10px 0 10px",
          flexWrap: "wrap"
        }}
      >
        {visibleTabs.map(tab => {
          const isActive = tab.id === activeTabId;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                if (!collapsible) {
                  setActiveTabId(tab.id);
                  return;
                }
                setActiveTabId(current => {
                  if (current === tab.id) return null;
                  return tab.id;
                });
              }}
              style={{
                padding: "8px 10px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.12)",
                background: isActive ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.05)",
                color: isActive ? "#fff" : "rgba(255,255,255,0.75)",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {isOpen && (
        <div
          style={{
            padding: 10,
            minHeight: 0,
            flex: "1 1 auto",
            overflow: "hidden"
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              overflow: "auto",
              paddingRight: 4
            }}
          >
            {activeTab?.content}
          </div>
        </div>
      )}
    </div>
  );
}

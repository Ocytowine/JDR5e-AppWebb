import React from "react";
import { EDITOR_THEME } from "./editorTheme";

export function MapEditorSidebar(props: {
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      style={{
        position: "absolute",
        left: 16,
        top: 16,
        zIndex: 5,
        display: "grid",
        gap: 12,
        width: "min(620px, calc(100vw - 32px))",
        minWidth: "min(620px, calc(100vw - 32px))",
        maxHeight: "calc(100% - 32px)",
        overflowY: "auto",
        overflowX: "hidden",
        paddingRight: 4,
        scrollbarGutter: "stable",
        overscrollBehavior: "contain",
        color: EDITOR_THEME.colors.text,
        fontFamily: EDITOR_THEME.fontFamily
      }}
    >
      {props.children}
    </div>
  );
}

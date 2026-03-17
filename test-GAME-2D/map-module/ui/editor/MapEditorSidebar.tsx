import React from "react";

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
        width: "min(360px, calc(100vw - 32px))",
        maxHeight: "calc(100% - 32px)",
        overflowY: "auto",
        paddingRight: 4
      }}
    >
      {props.children}
    </div>
  );
}

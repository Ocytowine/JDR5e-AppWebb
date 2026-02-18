import React, { useEffect, useMemo, useState } from "react";

type ParsedLogLine = {
  raw: string;
  message: string;
  tag: string | null;
};

const TAG_PATTERN = /^\[([a-z0-9_-]+)\]\s*(.*)$/i;

const TAG_COLORS: Record<string, string> = {
  economy: "#f3c969",
  feature: "#8dd6ff",
  "dual-wield": "#9be8a8",
  wm: "#ffaf87",
  pipeline: "#d7b6ff",
  map: "#95d5ff",
  ia: "#ff9fc3",
  "pipeline-ui": "#d7b6ff",
  log: "#c9d1d9"
};

export function LogPanel(props: { log: string[] }): React.JSX.Element {
  const entries = useMemo<ParsedLogLine[]>(
    () =>
      props.log.map(line => {
        const raw = String(line ?? "");
        const match = raw.match(TAG_PATTERN);
        if (!match) return { raw, message: raw, tag: null };
        const tag = match[1].toLowerCase();
        const message = match[2] ? match[2] : raw;
        return { raw, message, tag };
      }),
    [props.log]
  );
  const availableTags = useMemo(
    () => Array.from(new Set(entries.map(entry => entry.tag).filter((tag): tag is string => Boolean(tag)))).sort(),
    [entries]
  );
  const [activeTag, setActiveTag] = useState<string>("all");
  useEffect(() => {
    if (activeTag !== "all" && !availableTags.includes(activeTag)) {
      setActiveTag("all");
    }
  }, [activeTag, availableTags]);
  const visibleEntries =
    activeTag === "all" ? entries : entries.filter(entry => entry.tag === activeTag);

  return (
    <section
      style={{
        padding: "8px 12px",
        background: "#141421",
        borderRadius: 8,
        border: "1px solid #333",
        flex: "1 1 auto",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        maxHeight: "100%",
        minHeight: 0
      }}
    >
      <h2 style={{ margin: "0 0 8px" }}>Log</h2>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          marginBottom: 8
        }}
      >
        <button
          type="button"
          onClick={() => setActiveTag("all")}
          style={{
            border: "1px solid #3f4554",
            borderRadius: 999,
            padding: "2px 8px",
            background: activeTag === "all" ? "#2b3242" : "#1a1f2e",
            color: "#d9e1ea",
            cursor: "pointer",
            fontSize: 11
          }}
        >
          all
        </button>
        {availableTags.map(tag => (
          <button
            key={tag}
            type="button"
            onClick={() => setActiveTag(tag)}
            style={{
              border: "1px solid #3f4554",
              borderRadius: 999,
              padding: "2px 8px",
              background: activeTag === tag ? "#2b3242" : "#1a1f2e",
              color: TAG_COLORS[tag] ?? "#d9e1ea",
              cursor: "pointer",
              fontSize: 11
            }}
          >
            {tag}
          </button>
        ))}
      </div>
      <div
        style={{
          flex: "1 1 auto",
          overflowY: "auto",
          fontSize: 12,
          lineHeight: 1.4,
          minHeight: 0
        }}
      >
        {visibleEntries.map((entry, idx) => (
          <div key={`${entry.raw}-${idx}`} style={{ color: entry.tag ? TAG_COLORS[entry.tag] ?? "#c9d1d9" : "#c9d1d9" }}>
            {entry.tag ? `[${entry.tag}] ` : ""}{entry.message}
          </div>
        ))}
      </div>
    </section>
  );
}


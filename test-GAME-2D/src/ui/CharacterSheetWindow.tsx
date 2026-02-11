import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Personnage, TokenState } from "../types";
import type { WeaponTypeDefinition } from "../game/weaponTypes";

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatMod(value?: number): string {
  if (typeof value !== "number") return "-";
  return value >= 0 ? `+${value}` : `${value}`;
}

function formatList(list?: Array<string | number>, fallback = "-"): string {
  if (!list || list.length === 0) return fallback;
  return list.join(", ");
}

function formatMovementModes(modes?: Record<string, number> | string[]): string | null {
  if (!modes) return null;
  if (Array.isArray(modes)) {
    if (modes.length === 0) return null;
    return modes.map(id => `${id.charAt(0).toUpperCase()}${id.slice(1)}`).join(", ");
  }
  const entries = Object.entries(modes);
  if (entries.length === 0) return null;
  return entries
    .map(([key, value]) => {
      const label = key ? `${key.charAt(0).toUpperCase()}${key.slice(1)}` : "Mode";
      return `${label} ${value}`;
    })
    .join(", ");
}

function Section(props: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12,
        padding: 10,
        display: "flex",
        flexDirection: "column",
        gap: 8
      }}
    >
      <div style={{ fontSize: 12, fontWeight: 900, color: "#fff", letterSpacing: 0.4 }}>
        {props.title}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>{props.children}</div>
    </div>
  );
}

function StatRow(props: { label: string; value: React.ReactNode; dim?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ color: props.dim ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.75)" }}>
        {props.label}
      </span>
      <span style={{ color: "#fff", fontWeight: 800, textAlign: "right" }}>{props.value}</span>
    </div>
  );
}

function Chip(props: { label: string; tone?: "accent" | "muted" }) {
  const bg = props.tone === "accent" ? "rgba(88, 205, 255, 0.18)" : "rgba(255,255,255,0.08)";
  const color = props.tone === "accent" ? "#e9fbff" : "rgba(255,255,255,0.8)";
  return (
    <span
      style={{
        padding: "4px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        background: bg,
        color,
        border: "1px solid rgba(255,255,255,0.08)",
        textTransform: "none"
      }}
    >
      {props.label}
    </span>
  );
}

function ChipList(props: { items: string[]; accent?: boolean; emptyLabel?: string }) {
  if (!props.items || props.items.length === 0) {
    return <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{props.emptyLabel}</div>;
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {props.items.map(item => (
        <Chip key={item} label={item} tone={props.accent ? "accent" : "muted"} />
      ))}
    </div>
  );
}

function formatCoins(coins?: Record<string, number>): string {
  if (!coins) return "-";
  const entries = Object.entries(coins).filter(([, value]) => typeof value === "number" && value !== 0);
  if (entries.length === 0) return "0";
  return entries.map(([key, value]) => `${value} ${key}`).join(" | ");
}

function formatSlots(slots?: Record<string, any>): Array<{ label: string; text: string }> {
  if (!slots) return [];
  const entries = Object.entries(slots)
    .map(([level, data]) => {
      if (!data || typeof data !== "object") return null;
      const max = (data as any).max;
      const remaining = (data as any).remaining;
      if (typeof max !== "number" && typeof remaining !== "number") return null;
      const safeMax = typeof max === "number" ? max : "-";
      const safeRemaining = typeof remaining === "number" ? remaining : "-";
      return { label: `Niv ${level}`, text: `${safeRemaining} / ${safeMax}` };
    })
    .filter(Boolean) as Array<{ label: string; text: string }>;
  return entries.sort((a, b) => Number(a.label.replace("Niv ", "")) - Number(b.label.replace("Niv ", "")));
}

export function CharacterSheetWindow(props: {
  open: boolean;
  anchorX: number;
  anchorY: number;
  character: Personnage;
  player: TokenState;
  equippedWeapons: WeaponTypeDefinition[];
  itemLabels?: Record<string, string>;
  initiativeRoll?: number | null;
  initiativeMod?: number | null;
  initiativeTotal?: number | null;
  actionsRemaining: number;
  bonusRemaining: number;
  resources: Record<string, number>;
  onClose: () => void;
}): React.ReactNode {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number }>({ left: 8, top: 8 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [showCharacterJson, setShowCharacterJson] = useState<boolean>(false);
  const dragRef = useRef<{
    startClientX: number;
    startClientY: number;
    startLeft: number;
    startTop: number;
  } | null>(null);

  useLayoutEffect(() => {
    if (!props.open) return;
    const el = containerRef.current;
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;
    const parentRect = parent.getBoundingClientRect();
    const rect = el.getBoundingClientRect();
    const left = clamp(8, 8, Math.max(8, parentRect.width - rect.width - 8));
    const top = clamp(8, 8, Math.max(8, parentRect.height - rect.height - 8));
    setPos({ left, top });
  }, [props.open]);

  useEffect(() => {
    if (!isDragging) return;

    const onMove = (event: PointerEvent) => {
      const el = containerRef.current;
      const drag = dragRef.current;
      if (!el || !drag) return;
      const parent = el.parentElement;
      if (!parent) return;
      const parentRect = parent.getBoundingClientRect();
      const rect = el.getBoundingClientRect();
      const dx = event.clientX - drag.startClientX;
      const dy = event.clientY - drag.startClientY;
      const nextLeft = drag.startLeft + dx;
      const nextTop = drag.startTop + dy;
      const left = clamp(nextLeft, 8, Math.max(8, parentRect.width - rect.width - 8));
      const top = clamp(nextTop, 8, Math.max(8, parentRect.height - rect.height - 8));
      setPos({ left, top });
    };

    const onUp = () => {
      setIsDragging(false);
      dragRef.current = null;
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
    };
  }, [isDragging]);

  if (!props.open) return null;

  const stats = props.player.combatStats ?? props.character.combatStats;
  const charName = props.character?.nom?.nomcomplet ?? "Personnage";
  const nickName = props.character?.nom?.surnom ? `"${props.character.nom.surnom}"` : "";
  const subtitleParts = [props.character?.nom?.prenom, nickName].filter(Boolean).join(" ");
  const movementSummary =
    formatMovementModes(props.character.movementModes) ??
    (typeof stats?.moveRange === "number" || typeof props.player.moveRange === "number"
      ? `Standard ${stats?.moveRange ?? props.player.moveRange ?? 0}`
      : "Inconnu");
  const equippedWeapons = props.equippedWeapons ?? [];
  const attackRange =
    equippedWeapons.length === 0
      ? 1.5
      : Math.max(
          1.5,
          ...equippedWeapons.map(weapon => {
            const reach = weapon.properties?.reach;
            if (typeof reach === "number" && reach > 0) return reach;
            const range = weapon.properties?.range?.normal;
            if (typeof range === "number" && range > 0) return range;
            return 1.5;
          })
        );

  const classEntries = Object.entries(props.character?.classe ?? {}).map(([key, value]) => {
    const name = value?.classeId ?? key;
    const level = value?.niveau ?? "-";
    const sub = value?.subclasseId ? ` (${value.subclasseId})` : "";
    return `${name}${sub} L${level}`;
  });

  const abilities = [
    { key: "FOR", label: "FOR", score: props.character.caracs?.force?.FOR, mod: props.character.caracs?.force?.modFOR },
    { key: "DEX", label: "DEX", score: props.character.caracs?.dexterite?.DEX, mod: props.character.caracs?.dexterite?.modDEX },
    { key: "CON", label: "CON", score: props.character.caracs?.constitution?.CON, mod: props.character.caracs?.constitution?.modCON },
    { key: "INT", label: "INT", score: props.character.caracs?.intelligence?.INT, mod: props.character.caracs?.intelligence?.modINT },
    { key: "SAG", label: "SAG", score: props.character.caracs?.sagesse?.SAG, mod: props.character.caracs?.sagesse?.modSAG },
    { key: "CHA", label: "CHA", score: props.character.caracs?.charisme?.CHA, mod: props.character.caracs?.charisme?.modCHA }
  ];

  const profs = props.character.proficiencies ?? {};
  const inventoryItems = props.character.inventoryItems ?? [];
  const equipmentSlots = props.character.materielSlots ?? {};
  const spellSlots = formatSlots(props.character.spellcastingState?.slots);
  const spellSource = props.character.spellcastingState?.sources
    ? Object.values(props.character.spellcastingState.sources)[0]
    : undefined;
  const resolveItemLabel = (value: string | null | undefined): string => {
    if (!value) return "-";
    return props.itemLabels?.[value] ?? value;
  };

  const initiativeValue = (() => {
    const total = props.initiativeTotal;
    if (typeof total === "number") {
      const roll = props.initiativeRoll;
      const mod = props.initiativeMod;
      if (typeof roll === "number" && typeof mod === "number") {
        const modText = mod >= 0 ? `+${mod}` : `${mod}`;
        return `${total} (d20=${roll} ${modText})`;
      }
      return total;
    }
    return "-";
  })();

  return (
    <div
      ref={containerRef}
      onWheelCapture={event => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onWheel={event => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onMouseDown={event => event.stopPropagation()}
      style={{
        position: "absolute",
        right: 8,
        top: 8,
        bottom: 8,
        zIndex: 65,
        width: 560,
        maxWidth: "min(92vw, 720px)",
        background: "rgba(8, 10, 14, 0.95)",
        border: "1px solid rgba(255,255,255,0.14)",
        borderRadius: 14,
        padding: 12,
        boxShadow: "0 24px 70px rgba(0,0,0,0.6)",
        backdropFilter: "blur(8px)",
        display: "flex",
        flexDirection: "column",
        gap: 10
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <div
          onPointerDown={event => {
            if (event.button !== 0) return;
            const el = containerRef.current;
            if (!el) return;
            event.preventDefault();
            event.stopPropagation();
            dragRef.current = {
              startClientX: event.clientX,
              startClientY: event.clientY,
              startLeft: pos.left,
              startTop: pos.top
            };
            setIsDragging(true);
          }}
          style={{
            minWidth: 0,
            flex: "1 1 auto",
            cursor: isDragging ? "grabbing" : "grab",
            userSelect: "none"
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 900, color: "#fff" }}>Fiche personnage</div>
          <div style={{ marginTop: 4, fontSize: 12, color: "rgba(255,255,255,0.75)" }}>
            {charName}
          </div>
          {subtitleParts && (
            <div style={{ marginTop: 2, fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
              {subtitleParts}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={props.onClose}
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.14)",
            background: "rgba(255,255,255,0.06)",
            color: "rgba(255,255,255,0.85)",
            cursor: "pointer",
            fontWeight: 900
          }}
        >
          X
        </button>
      </div>

      <div style={{ marginTop: 4, display: "flex", justifyContent: "flex-end" }}>
        <button
          type="button"
          onClick={() => setShowCharacterJson(prev => !prev)}
          style={{
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.08)",
            color: "#f5f5f5",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 700
          }}
        >
          {showCharacterJson ? "Masquer le JSON" : "Afficher le JSON"}
        </button>
      </div>

      {showCharacterJson && (
        <pre
          style={{
            marginTop: 6,
            maxHeight: 200,
            overflow: "auto",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            fontSize: 11,
            color: "rgba(255,255,255,0.8)",
            background: "#0f0f19",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 8,
            padding: 8
          }}
        >
          {JSON.stringify(props.character, null, 2)}
        </pre>
      )}

      <div style={{ flex: "1 1 auto", minHeight: 0, overflow: "auto", paddingRight: 4, display: "grid", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10 }}>
          <Section title="Etat">
            <StatRow label="PV" value={`${props.player.hp} / ${props.player.maxHp}`} />
            <StatRow label="PV temporaires" value={props.player.tempHp ?? props.character.pvTmp ?? 0} />
            <StatRow
              label="Fatigue"
              value={`${props.character.nivFatigueActuel ?? 0} / ${props.character.nivFatigueMax ?? 0}`}
            />
            <StatRow label="Actions" value={props.actionsRemaining} />
            <StatRow label="Bonus" value={props.bonusRemaining} />
            <StatRow label="Inspiration" value={props.character.inspiration ? "Oui" : "Non"} />
          </Section>

          <Section title="Combat">
            <StatRow label="CA" value={stats?.armorClass ?? props.player.armorClass ?? 10} />
            <StatRow label="Portee" value={attackRange} />
            <StatRow label="Deplacements" value={movementSummary} />
            <StatRow label="Initiative" value={initiativeValue} />
            <StatRow label="Perception passive" value={props.character.percPassive ?? "-"} />
            <StatRow label="Vision" value={props.character.visionProfile?.lightVision ?? "-"} />
          </Section>

          <Section title="Classe">
            <StatRow label="Classes" value={formatList(classEntries, "-")} />
            <StatRow label="Maitrise" value={props.character.maitriseBonus ?? "-"} />
            <StatRow label="XP" value={props.character.xp ?? "-"} />
            <StatRow label="DV" value={props.character.dv ?? "-"} />
          </Section>

        </div>

        <Section title="Caracteristiques">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
            {abilities.map(ability => (
              <div
                key={ability.key}
                style={{
                  background: "rgba(255,255,255,0.04)",
                  borderRadius: 10,
                  border: "1px solid rgba(255,255,255,0.08)",
                  padding: 8,
                  display: "flex",
                  flexDirection: "column",
                  gap: 4
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>{ability.label}</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "rgba(255,255,255,0.65)" }}>Score</span>
                  <span style={{ color: "#fff", fontWeight: 800 }}>{ability.score ?? "-"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ color: "rgba(255,255,255,0.65)" }}>Mod</span>
                  <span style={{ color: "#fff", fontWeight: 800 }}>{formatMod(ability.mod)}</span>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10 }}>
          <Section title="Competences">
            <ChipList items={props.character.competences ?? []} emptyLabel="Aucune competence." />
          </Section>

          <Section title="Expertises">
            <ChipList items={props.character.expertises ?? []} emptyLabel="Aucune expertise." />
          </Section>

          <Section title="Jets de sauvegarde">
            <ChipList items={props.character.savingThrows ?? []} emptyLabel="Aucun jet." accent />
          </Section>

          <Section title="Langues">
            <ChipList items={props.character.langues ?? []} emptyLabel="Aucune langue." />
          </Section>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10 }}>
          <Section title="Maitrises">
            <StatRow label="Armes" value={formatList(profs.weapons)} />
            <StatRow label="Armures" value={formatList(profs.armors)} />
            <StatRow label="Outils" value={formatList(profs.tools)} />
          </Section>

          <Section title="Actions">
            <ChipList items={props.character.actionIds ?? props.player.actionIds ?? []} emptyLabel="Aucune action." />
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>Reactions</div>
              <ChipList
                items={props.character.reactionIds ?? props.player.reactionIds ?? []}
                emptyLabel="Aucune reaction."
              />
            </div>
          </Section>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 10 }}>
          <Section title="Equipement">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 6 }}>
              {Object.entries(equipmentSlots).filter(([, item]) => item).length === 0 && (
                <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>Aucun slot.</div>
              )}
              {Object.entries(equipmentSlots)
                .filter(([, item]) => item)
                .map(([slot, item]) => (
                <div key={slot} style={{ fontSize: 12, color: "rgba(255,255,255,0.75)" }}>
                  <span style={{ fontWeight: 800, color: "#fff" }}>{slot}</span>:{" "}
                  {resolveItemLabel(String(item))}
                </div>
              ))}
            </div>
          </Section>

          <Section title="Inventaire">
            {inventoryItems.length === 0 && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>Inventaire vide.</div>
            )}
            {inventoryItems.map(item => (
              <div key={item.instanceId ?? `${item.id}-${item.qty}`} style={{ fontSize: 12 }}>
                <span style={{ color: "#fff", fontWeight: 700 }}>{item.qty}x</span>{" "}
                <span style={{ color: "rgba(255,255,255,0.8)" }}>
                  {resolveItemLabel(String(item.id))}
                </span>
                {item.equippedSlot && (
                  <span style={{ color: "rgba(255,255,255,0.55)" }}> (eq: {item.equippedSlot})</span>
                )}
                {item.storedIn && (
                  <span style={{ color: "rgba(255,255,255,0.55)" }}> (dans {item.storedIn})</span>
                )}
              </div>
            ))}
            <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.75)" }}>
              Argent: <span style={{ color: "#fff", fontWeight: 800 }}>{formatCoins(props.character.argent)}</span>
            </div>
          </Section>

          <Section title="Armes equipees">
            {equippedWeapons.length === 0 && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>Aucune arme equipee.</div>
            )}
            {equippedWeapons.map(weapon => {
              const damage = weapon.damage?.dice ?? "?";
              const damageType = weapon.damage?.damageType ?? "";
              const subtitle = damageType ? `${damage} ${damageType}` : damage;
              return <StatRow key={weapon.id} label={weapon.name} value={subtitle} dim />;
            })}
          </Section>
        </div>

        <Section title="Magie">
          {spellSlots.length === 0 && (
            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>Aucun emplacement.</div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
            {spellSlots.map(slot => {
              const parts = slot.text.split("/").map(v => v.trim());
              const remaining = Number(parts[0]);
              const max = Number(parts[1]);
              const total = Number.isFinite(max) ? max : 0;
              const filled = Number.isFinite(remaining) ? remaining : 0;
              return (
                <div key={slot.label} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  <div style={{ fontSize: 12, color: "rgba(255,255,255,0.75)", fontWeight: 800 }}>
                    {slot.label}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {Array.from({ length: total }).map((_, idx) => {
                      const isFilled = idx < filled;
                      return (
                        <span
                          key={`${slot.label}-${idx}`}
                          style={{
                            width: 16,
                            height: 16,
                            borderRadius: 6,
                            border: "1px solid rgba(140, 220, 255, 0.35)",
                            background: isFilled ? "rgba(120, 220, 255, 0.75)" : "rgba(20, 28, 36, 0.6)",
                            boxShadow: isFilled
                              ? "0 0 10px rgba(120, 220, 255, 0.9), inset 0 0 6px rgba(255,255,255,0.6)"
                              : "inset 0 0 6px rgba(0,0,0,0.6)"
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>Sorts prepares</div>
            <ChipList items={spellSource?.preparedSpellIds ?? []} emptyLabel="Aucun sort prepare." />
          </div>
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>Sorts accordes</div>
            <ChipList items={spellSource?.grantedSpellIds ?? []} emptyLabel="Aucun sort accorde." />
          </div>
        </Section>

      </div>
    </div>
  );
}

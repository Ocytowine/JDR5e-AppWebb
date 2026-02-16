import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Personnage, TokenState } from "../types";
import type { WeaponTypeDefinition } from "../game/weaponTypes";
import type { ActionDefinition } from "../game/actionTypes";
import type { SpellDefinition } from "../game/spellCatalog";
import { JsonInfoPanel } from "./JsonInfoPanel";

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

function ChipButton(props: { label: string; onClick?: () => void; title?: string }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      title={props.title}
      style={{
        padding: "4px 8px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        background: "rgba(255,255,255,0.08)",
        color: "rgba(255,255,255,0.85)",
        border: "1px solid rgba(255,255,255,0.12)",
        cursor: "pointer"
      }}
    >
      {props.label}
    </button>
  );
}

function ChipButtonList(props: {
  items: string[];
  emptyLabel?: string;
  onSelect: (id: string) => void;
}) {
  if (!props.items || props.items.length === 0) {
    return <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>{props.emptyLabel}</div>;
  }
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {props.items.map(item => (
        <ChipButton key={item} label={item} onClick={() => props.onSelect(item)} />
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

function formatWeaponRangeLabel(weapon: WeaponTypeDefinition): string {
  const properties = weapon?.properties ?? {};
  const thrown = properties?.thrown;
  const range = properties?.range;
  if (thrown && typeof thrown.normal === "number" && typeof thrown.long === "number") {
    return `jet ${thrown.normal}/${thrown.long} m`;
  }
  if (range && typeof range.normal === "number") {
    if (typeof range.long === "number" && range.long > range.normal) {
      return `portee ${range.normal}/${range.long} m`;
    }
    return `portee ${range.normal} m`;
  }
  if (typeof properties?.reach === "number" && properties.reach > 0) {
    return `allonge ${properties.reach} m`;
  }
  return "portee -";
}

function formatWeaponDamageLabel(weapon: WeaponTypeDefinition): string {
  const baseDice = weapon.damage?.dice ?? "?";
  const baseType = weapon.damage?.damageType ?? "?";
  const base = `${baseDice} ${baseType}`;
  const extras = Array.isArray(weapon.extraDamage) ? weapon.extraDamage : [];
  const extraText = extras
    .map(entry => {
      const dice = String(entry?.dice ?? "").trim();
      const type = String(entry?.damageType ?? "").trim();
      if (!dice || !type) return null;
      const when = String(entry?.when ?? "onHit");
      return when === "onHit" ? `+${dice} ${type}` : `+${dice} ${type} (${when})`;
    })
    .filter(Boolean)
    .join(" + ");
  return extraText ? `${base} + ${extraText}` : base;
}

function isInventoryItemHarmonized(item: any): boolean {
  if (!item) return false;
  if (item.harmonized === true || item.isHarmonized === true || item.attuned === true) return true;
  if (item?.attunement?.state === "harmonized") return true;
  if (typeof item?.attunement?.harmonizedAt === "string" && item.attunement.harmonizedAt.length > 0) {
    return true;
  }
  return false;
}

export function CharacterSheetWindow(props: {
  open: boolean;
  anchorX: number;
  anchorY: number;
  character: Personnage;
  player: TokenState;
  equippedWeapons: WeaponTypeDefinition[];
  weaponById?: Map<string, WeaponTypeDefinition>;
  equipmentAppliedBonuses?: Array<{ bonusId: string; sourceItemId: string }>;
  itemLabels?: Record<string, string>;
  actionInfoById?: Map<string, ActionDefinition>;
  spellInfoById?: Map<string, SpellDefinition>;
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
  const [infoPanel, setInfoPanel] = useState<{ title: string; subtitle?: string; data: unknown } | null>(null);
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
  const weaponById = props.weaponById ?? new Map<string, WeaponTypeDefinition>();
  const equipmentAppliedBonuses = Array.isArray(props.equipmentAppliedBonuses)
    ? props.equipmentAppliedBonuses
    : [];
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
  const harmonizedByWeaponId = (() => {
    const map = new Map<string, { harmonisable: boolean; harmonized: boolean }>();
    inventoryItems
      .filter(
        item =>
          item?.type === "weapon" &&
          item?.equippedSlot &&
          new Set(["ceinture_gauche", "ceinture_droite", "dos_gauche", "dos_droit"]).has(item.equippedSlot)
      )
      .forEach(item => {
        const weapon = weaponById.get(String(item.id));
        if (!weapon) return;
        const current = map.get(String(item.id)) ?? { harmonisable: Boolean(weapon.harmonisable), harmonized: false };
        const next = {
          harmonisable: current.harmonisable || Boolean(weapon.harmonisable),
          harmonized: current.harmonized || isInventoryItemHarmonized(item)
        };
        map.set(String(item.id), next);
      });
    return map;
  })();
  const equipmentSlots = props.character.materielSlots ?? {};
  const spellSlots = formatSlots(props.character.spellcastingState?.slots);
  const spellSources = props.character.spellcastingState?.sources
    ? Object.values(props.character.spellcastingState.sources)
    : [];
  const spellIdsFromState = (() => {
    const prepared = new Set<string>();
    const granted = new Set<string>();
    const known = new Set<string>();
    spellSources.forEach(source => {
      const preparedIds = Array.isArray((source as any)?.preparedSpellIds)
        ? ((source as any).preparedSpellIds as string[])
        : [];
      const grantedIds = Array.isArray((source as any)?.grantedSpellIds)
        ? ((source as any).grantedSpellIds as string[])
        : [];
      const knownIds = Array.isArray((source as any)?.knownSpellIds)
        ? ((source as any).knownSpellIds as string[])
        : [];
      preparedIds.forEach(id => id && prepared.add(String(id)));
      grantedIds.forEach(id => id && granted.add(String(id)));
      knownIds.forEach(id => id && known.add(String(id)));
    });
    return {
      prepared: Array.from(prepared),
      granted: Array.from(granted),
      known: Array.from(known)
    };
  })();
  const spellIdsFromSelections = (() => {
    const prepared = new Set<string>();
    const granted = new Set<string>();
    const known = new Set<string>();
    const selections = (props.character as any)?.choiceSelections?.spellcasting;
    if (!selections || typeof selections !== "object") {
      return { prepared: [] as string[], granted: [] as string[], known: [] as string[] };
    }
    Object.values(selections as Record<string, any>).forEach(entry => {
      const preparedList = Array.isArray(entry?.preparedSpells) ? entry.preparedSpells : [];
      const grantedList = Array.isArray(entry?.grantedSpells) ? entry.grantedSpells : [];
      const knownList = Array.isArray(entry?.knownSpells) ? entry.knownSpells : [];
      preparedList.forEach(spell => {
        const id = typeof spell === "string" ? spell : spell?.id;
        if (id) prepared.add(String(id));
      });
      grantedList.forEach(spell => {
        const id = typeof spell === "string" ? spell : spell?.id;
        if (id) granted.add(String(id));
      });
      knownList.forEach(spell => {
        const id = typeof spell === "string" ? spell : spell?.id;
        if (id) known.add(String(id));
      });
    });
    return {
      prepared: Array.from(prepared),
      granted: Array.from(granted),
      known: Array.from(known)
    };
  })();
  const displayedPreparedSpellIds =
    spellIdsFromState.prepared.length > 0 ? spellIdsFromState.prepared : spellIdsFromSelections.prepared;
  const displayedGrantedSpellIds =
    spellIdsFromState.granted.length > 0 ? spellIdsFromState.granted : spellIdsFromSelections.granted;
  const displayedKnownSpellIds =
    spellIdsFromState.known.length > 0 ? spellIdsFromState.known : spellIdsFromSelections.known;
  const resolveItemLabel = (value: string | null | undefined): string => {
    if (!value) return "-";
    return props.itemLabels?.[value] ?? value;
  };
  const actionInfoById = props.actionInfoById ?? new Map();
  const spellInfoById = props.spellInfoById ?? new Map();
  const resourceEntries = Object.entries(props.resources ?? {})
    .map(([key, value]) => {
      const [poolRaw, nameRaw] = key.includes(":") ? key.split(":", 2) : ["default", key];
      const pool = poolRaw || "default";
      const name = nameRaw || key;
      const label = pool === "default" ? name : `${pool}:${name}`;
      return { key, label, value };
    })
    .filter(entry => Number.isFinite(entry.value))
    .sort((a, b) => a.label.localeCompare(b.label));

  const openActionInfo = (id: string) => {
    const def = actionInfoById.get(id);
    if (!def) {
      setInfoPanel({ title: `Action ${id}`, subtitle: "Non trouvee", data: { id } });
      return;
    }
    setInfoPanel({ title: def.name ?? def.id, subtitle: `Action ${def.id}`, data: def });
  };

  const openSpellInfo = (id: string) => {
    const def = spellInfoById.get(id);
    if (!def) {
      setInfoPanel({ title: `Sort ${id}`, subtitle: "Non trouve", data: { id } });
      return;
    }
    setInfoPanel({ title: def.name ?? def.id, subtitle: `Sort ${def.id}`, data: def });
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
        overflow: "hidden",
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
            <StatRow label="Bottes d'armes" value={formatList((props.character as any)?.weaponMasteries)} />
            <StatRow label="Armures" value={formatList(profs.armors)} />
            <StatRow label="Outils" value={formatList(profs.tools)} />
          </Section>

          <Section title="Actions">
            <ChipButtonList
              items={props.character.actionIds ?? props.player.actionIds ?? []}
              emptyLabel="Aucune action."
              onSelect={openActionInfo}
            />
            <div style={{ marginTop: 6 }}>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>Reactions</div>
              <ChipButtonList
                items={props.character.reactionIds ?? props.player.reactionIds ?? []}
                emptyLabel="Aucune reaction."
                onSelect={openActionInfo}
              />
            </div>
          </Section>

          <Section title="Ressources">
            {resourceEntries.length === 0 && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
                Aucune ressource suivie.
              </div>
            )}
            {resourceEntries.map(entry => (
              <StatRow key={entry.key} label={entry.label} value={entry.value} />
            ))}
          </Section>

          <Section title="Bonus equipement actifs">
            {equipmentAppliedBonuses.length === 0 && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>
                Aucun bonus actif.
              </div>
            )}
            {equipmentAppliedBonuses.map((entry, idx) => (
              <div key={`${entry.bonusId}-${entry.sourceItemId}-${idx}`} style={{ fontSize: 12 }}>
                <span style={{ color: "#fff", fontWeight: 700 }}>{entry.bonusId}</span>
                <span style={{ color: "rgba(255,255,255,0.62)" }}> (source: {resolveItemLabel(entry.sourceItemId)})</span>
              </div>
            ))}
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
            {inventoryItems.map(item => {
              const weapon = item?.type === "weapon" ? weaponById.get(String(item.id)) ?? null : null;
              const weaponSummary = weapon
                ? `${String(weapon.category ?? "?")} | ${formatWeaponDamageLabel(weapon)} | ${formatWeaponRangeLabel(weapon)}${
                    weapon.harmonisable
                      ? ` | harm:${isInventoryItemHarmonized(item) ? "active" : "inactive"}`
                      : ""
                  }`
                : null;
              return (
                <div
                  key={item.instanceId ?? `${item.id}-${item.qty}`}
                  style={{ fontSize: 12, display: "flex", flexDirection: "column", gap: 2 }}
                >
                  <div>
                    <span style={{ color: "#fff", fontWeight: 700 }}>{item.qty}x</span>{" "}
                    <span style={{ color: "rgba(255,255,255,0.8)" }} title={weaponSummary ?? undefined}>
                      {resolveItemLabel(String(item.id))}
                    </span>
                    {item.equippedSlot && (
                      <span style={{ color: "rgba(255,255,255,0.55)" }}> (eq: {item.equippedSlot})</span>
                    )}
                    {item.storedIn && (
                      <span style={{ color: "rgba(255,255,255,0.55)" }}> (dans {item.storedIn})</span>
                    )}
                  </div>
                  {weaponSummary && (
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.62)" }}>{weaponSummary}</div>
                  )}
                </div>
              );
            })}
            <div style={{ marginTop: 6, fontSize: 12, color: "rgba(255,255,255,0.75)" }}>
              Argent: <span style={{ color: "#fff", fontWeight: 800 }}>{formatCoins(props.character.argent)}</span>
            </div>
          </Section>

          <Section title="Armes equipees">
            {equippedWeapons.length === 0 && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.65)" }}>Aucune arme equipee.</div>
            )}
            {equippedWeapons.map(weapon => {
              const damageLabel = formatWeaponDamageLabel(weapon);
              const category = String(weapon.category ?? "?");
              const rangeLabel = formatWeaponRangeLabel(weapon);
              const harmonized = harmonizedByWeaponId.get(String(weapon.id));
              const harmonizedLabel =
                harmonized?.harmonisable
                  ? ` | harm:${harmonized.harmonized ? "active" : "inactive"}`
                  : "";
              const subtitle = `${category} | ${damageLabel} | ${rangeLabel}${harmonizedLabel}`;
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
            <ChipButtonList
              items={displayedPreparedSpellIds}
              emptyLabel="Aucun sort prepare."
              onSelect={openSpellInfo}
            />
          </div>
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>Sorts accordes</div>
            <ChipButtonList
              items={displayedGrantedSpellIds}
              emptyLabel="Aucun sort accorde."
              onSelect={openSpellInfo}
            />
          </div>
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginBottom: 4 }}>Sorts connus</div>
            <ChipButtonList
              items={displayedKnownSpellIds}
              emptyLabel="Aucun sort connu."
              onSelect={openSpellInfo}
            />
          </div>
        </Section>

      </div>
      <JsonInfoPanel
        open={Boolean(infoPanel)}
        title={infoPanel?.title ?? ""}
        subtitle={infoPanel?.subtitle ?? null}
        data={infoPanel?.data ?? {}}
        onClose={() => setInfoPanel(null)}
      />
    </div>
  );
}

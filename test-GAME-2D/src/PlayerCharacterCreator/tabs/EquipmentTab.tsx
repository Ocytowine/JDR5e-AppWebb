import React from "react";

export type EquipmentSlot = {
  id: string;
  label: string;
  accepts: string[];
  requiresClothingBody?: boolean;
};

type PackStatus = {
  bagId: string | null;
  capacity: number;
  storedWeight: number;
  totalWeight: number;
  maxTotal: number | null;
};

type SourceDot = { key: string; label: string };

type SlotGroups = {
  body: string[];
  weapons: string[];
  jewelry: string[];
  bag: string[];
  beltPacks: string[];
};

export function EquipmentTab(props: {
  toggleSectionLock: (id: string) => void;
  getLockButtonState: (id: string) => { background: string; label: string };
  renderPendingBadge: (count: number) => React.ReactNode;
  getPendingCountForSection: (id: string) => number;
  lockButtonBaseStyle: React.CSSProperties;
  equipSubTab: "slots" | "loot";
  setEquipSubTab: (value: "slots" | "loot") => void;
  equipMessage: string | null;
  setEquipMessage: (value: string | null) => void;
  slotGroups: SlotGroups;
  renderSlotGroup: (slotIds: string[], title: string, note?: string) => React.ReactNode;
  packSlotStatus: (slotId: string) => PackStatus;
  inventoryItems: Array<any>;
  getItemLabel: (item: any) => string;
  getItemCategories: (item: any) => string[];
  canUseClothingPieces: boolean;
  equipmentSlots: EquipmentSlot[];
  resolveStoredSlotId: (item: any) => string | null;
  packSlots: Set<string>;
  getSlotLabel: (slotId: string) => string;
  getItemWeight: (item: any) => number;
  storeItemInPack: (index: number, slotId: string) => void;
  updateItemSlot: (index: number, slot: string | null) => void;
  isSectionLocked: (id: string) => boolean;
  getItemUnitValue: (item: any) => any;
  isCurrencyItem: (item: any) => boolean;
  moneyToCopper: (value: any) => number;
  formatMoneyValue: (value: any) => string;
  onSellRequest: (index: number, item: any, itemValue: any) => void;
  setPrimaryWeapon: (index: number) => void;
  isItemHarmonisable: (item: any) => boolean;
  isItemHarmonized: (item: any) => boolean;
  toggleItemHarmonization: (index: number) => void;
  removeManualItem: (index: number) => void;
  renderSourceDotsWithLabels: (sources: SourceDot[]) => React.ReactNode;
  getItemSources: (item: any) => SourceDot[];
  carryWeight: number;
  carryCapacityMax: number;
  weaponOptions: Array<any>;
  toolItems: Array<any>;
  armorItems: Array<any>;
  objectItems: Array<any>;
  addManualItem: (id: string) => void;
}): React.JSX.Element {
  const {
    toggleSectionLock,
    getLockButtonState,
    renderPendingBadge,
    getPendingCountForSection,
    lockButtonBaseStyle,
    equipSubTab,
    setEquipSubTab,
    equipMessage,
    setEquipMessage,
    slotGroups,
    renderSlotGroup,
    packSlotStatus,
    inventoryItems,
    getItemLabel,
    getItemCategories,
    canUseClothingPieces,
    equipmentSlots,
    resolveStoredSlotId,
    packSlots,
    getSlotLabel,
    getItemWeight,
    storeItemInPack,
    updateItemSlot,
    isSectionLocked,
    getItemUnitValue,
    isCurrencyItem,
    moneyToCopper,
    formatMoneyValue,
    onSellRequest,
    setPrimaryWeapon,
    isItemHarmonisable,
    isItemHarmonized,
    toggleItemHarmonization,
    removeManualItem,
    renderSourceDotsWithLabels,
    getItemSources,
    carryWeight,
    carryCapacityMax,
    weaponOptions,
    toolItems,
    armorItems,
    objectItems,
    addManualItem
  } = props;

  const formatRangeLabel = (weapon: any): string => {
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
  };

  const formatWeaponSummary = (weapon: any): string => {
    const category = String(weapon?.category ?? "?");
    const damageDice = String(weapon?.damage?.dice ?? "?");
    const damageType = String(weapon?.damage?.damageType ?? "?");
    const extraDamage = Array.isArray(weapon?.extraDamage) ? weapon.extraDamage : [];
    const extras = extraDamage
      .map((entry: any) => {
        const dice = String(entry?.dice ?? "").trim();
        const type = String(entry?.damageType ?? "").trim();
        if (!dice || !type) return null;
        const when = String(entry?.when ?? "onHit");
        return when === "onHit" ? `+${dice} ${type}` : `+${dice} ${type} (${when})`;
      })
      .filter(Boolean)
      .join(" + ");
    const rangeLabel = formatRangeLabel(weapon);
    const damageLabel = extras
      ? `${damageDice} ${damageType} + ${extras}`
      : `${damageDice} ${damageType}`;
    return `${category} | ${damageLabel} | ${rangeLabel}`;
  };

  const weaponById = new Map<string, any>();
  weaponOptions.forEach(weapon => {
    if (weapon?.id) weaponById.set(String(weapon.id), weapon);
  });

  const getWeaponSummaryForItem = (item: any): string | null => {
    if (item?.type !== "weapon") return null;
    const weapon = weaponById.get(String(item.id));
    if (!weapon) return null;
    return formatWeaponSummary(weapon);
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ fontSize: 12, color: "#b0b8c4" }}>
          Equipez les objets compatibles dans chaque slot. Les selections respectent les categories.
        </div>
        <button
          type="button"
          onClick={() => toggleSectionLock("equip")}
          style={{
            ...lockButtonBaseStyle,
            marginLeft: "auto",
            background: getLockButtonState("equip").background
          }}
        >
          {getLockButtonState("equip").label}
          {renderPendingBadge(getPendingCountForSection("equip"))}
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        {([
          { id: "slots", label: "Equipement" },
          { id: "loot", label: "Boite a loot" }
        ] as const).map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setEquipSubTab(tab.id)}
            style={{
              padding: "4px 10px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.15)",
              background:
                equipSubTab === tab.id
                  ? "rgba(46, 204, 113, 0.18)"
                  : "rgba(255,255,255,0.06)",
              color: "#f5f5f5",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 700
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {equipMessage && (
        <div
          style={{
            marginTop: 6,
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.18)",
            background: "rgba(231, 76, 60, 0.18)",
            fontSize: 11,
            color: "#f5f5f5",
            display: "flex",
            alignItems: "center",
            gap: 8
          }}
        >
          <span>{equipMessage}</span>
          <button
            type="button"
            onClick={() => setEquipMessage(null)}
            style={{
              marginLeft: "auto",
              border: "none",
              background: "transparent",
              color: "#f5f5f5",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 700
            }}
          >
            OK
          </button>
        </div>
      )}
      {equipSubTab === "slots" && (
        <>
          <div
            style={{
              marginTop: 8,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: 10
            }}
          >
            {renderSlotGroup(
              slotGroups.body,
              "Vetements / Armures",
              "Corps: armure ou vetement. Vetements secondaires actifs si vetement au corps."
            )}
            {renderSlotGroup(slotGroups.weapons, "Armes et protections")}
            {renderSlotGroup(slotGroups.jewelry, "Bijoux")}
            {renderSlotGroup(slotGroups.bag, "Paquetage")}
            {renderSlotGroup(slotGroups.beltPacks, "Ceinture (bourses)")}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 6 }}>
            {(() => {
              const mainBag = packSlotStatus("paquetage");
              const belt1 = packSlotStatus("ceinture_bourse_1");
              const belt2 = packSlotStatus("ceinture_bourse_2");
              const mainLabel = mainBag.bagId
                ? `${mainBag.storedWeight.toFixed(1)} / ${mainBag.capacity.toFixed(1)} poids`
                : "aucun sac equipe";
              const belt1Label = belt1.bagId
                ? `${belt1.storedWeight.toFixed(1)} / ${belt1.capacity.toFixed(1)} poids`
                : "—";
              const belt2Label = belt2.bagId
                ? `${belt2.storedWeight.toFixed(1)} / ${belt2.capacity.toFixed(1)} poids`
                : "—";
              return (
                <>
                  <div>Paquetage: {mainLabel}</div>
                  <div>
                    Ceinture: bourse 1 {belt1Label} · bourse 2 {belt2Label}
                  </div>
                </>
              );
            })()}
          </div>
          <div
            style={{
              marginTop: 10,
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(12,12,18,0.75)",
              padding: 10,
              display: "flex",
              flexDirection: "column",
              gap: 8
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700 }}>Inventaire</div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
              Equiper un slot ou ranger dans un sac (si disponible).
            </div>
            <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
              Capacite de port: {carryWeight.toFixed(1)} / {carryCapacityMax.toFixed(1)} kg
            </div>
            {inventoryItems.length === 0 && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                Aucun item pour l'instant.
              </div>
            )}
            {inventoryItems.map((item, idx) => {
              const eligibleSlots = equipmentSlots.filter(slot => {
                if (slot.requiresClothingBody && !canUseClothingPieces) return false;
                const categories = getItemCategories(item);
                return categories.some(cat => slot.accepts.includes(cat));
              });
              const itemSources = getItemSources(item);
              const storedSlotId = resolveStoredSlotId(item);
              const packOptions = Array.from(packSlots)
                .map(slotId => {
                  const status = packSlotStatus(slotId);
                  if (!status.bagId || status.capacity <= 0) return null;
                  const containerItem = inventoryItems.find(
                    entry => entry?.equippedSlot === slotId && entry?.id === status.bagId
                  );
                  const itemWeight = getItemWeight(item) * (Number(item?.qty ?? 1) || 1);
                  const alreadyStored = storedSlotId === slotId;
                  const bagWeight = status.totalWeight - status.storedWeight;
                  const capacityOk =
                    alreadyStored || status.storedWeight + itemWeight <= status.capacity;
                  const totalOk =
                    typeof status.maxTotal === "number"
                      ? alreadyStored ||
                        bagWeight + status.storedWeight + itemWeight <= status.maxTotal
                      : true;
                  const selfOk = !containerItem || containerItem !== item;
                  return {
                    slotId,
                    label: getSlotLabel(slotId),
                    canStore: Boolean(selfOk && capacityOk && totalOk)
                  };
                })
                .filter(Boolean) as Array<{ slotId: string; label: string; canStore: boolean }>;
              const itemValue = getItemUnitValue(item);
              const canSell =
                !isCurrencyItem(item) &&
                !isSectionLocked("equip") &&
                itemValue &&
                moneyToCopper(itemValue) > 0;
              const qtyLabel = (item?.qty ?? 1) > 1 ? ` x${item.qty}` : "";
              const weaponSummary = getWeaponSummaryForItem(item);
              const harmonisable = isItemHarmonisable(item);
              const harmonized = harmonisable ? isItemHarmonized(item) : false;
              return (
                <div
                  key={`inv-${idx}`}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr auto auto auto auto auto",
                    gap: 8,
                    alignItems: "center",
                    fontSize: 12
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "flex-start",
                      gap: 2
                    }}
                  >
                    <span
                      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                      title={weaponSummary ?? undefined}
                    >
                      {getItemLabel(item)}
                      {qtyLabel}
                      {renderSourceDotsWithLabels(itemSources)}
                    </span>
                    {weaponSummary && (
                      <span style={{ fontSize: 10, color: "rgba(255,255,255,0.62)" }}>
                        {weaponSummary}
                      </span>
                    )}
                    {harmonisable && (
                      <span style={{ fontSize: 10, color: "rgba(130, 220, 255, 0.82)" }}>
                        Harmonisation: {harmonized ? "active" : "inactive"}
                      </span>
                    )}
                  </span>
                  <select
                    value={
                      storedSlotId
                        ? `__pack:${storedSlotId}`
                        : item.equippedSlot
                          ? item.equippedSlot
                          : ""
                    }
                    onChange={e => {
                      const value = e.target.value;
                      if (value.startsWith("__pack:")) {
                        const slotId = value.replace("__pack:", "");
                        storeItemInPack(idx, slotId);
                        return;
                      }
                      if (!value) {
                        updateItemSlot(idx, null);
                        return;
                      }
                      updateItemSlot(idx, value);
                    }}
                    style={{
                      background: "#0f0f19",
                      color: "#f5f5f5",
                      border: "1px solid #333",
                      borderRadius: 6,
                      padding: "2px 6px",
                      fontSize: 11
                    }}
                    disabled={isSectionLocked("equip")}
                  >
                    <option value="">Non equipe</option>
                    {eligibleSlots.map(slot => (
                      <option key={`item-slot-${idx}-${slot.id}`} value={slot.id}>
                        {slot.label}
                      </option>
                    ))}
                    {packOptions.map(option => (
                      <option
                        key={`item-pack-${idx}-${option.slotId}`}
                        value={`__pack:${option.slotId}`}
                        disabled={!option.canStore}
                      >
                        Ranger dans {option.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (!canSell) return;
                      onSellRequest(idx, item, itemValue);
                    }}
                    disabled={!canSell}
                    style={{
                      borderRadius: 6,
                      border: "1px solid rgba(255,255,255,0.2)",
                      background: canSell
                        ? "rgba(241, 196, 15, 0.2)"
                        : "rgba(255,255,255,0.06)",
                      color: canSell ? "#f8e58c" : "rgba(255,255,255,0.5)",
                      cursor: canSell ? "pointer" : "not-allowed",
                      fontSize: 12,
                      padding: "2px 6px",
                      fontWeight: 700
                    }}
                    title="Vendre"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                      <circle
                        cx="12"
                        cy="12"
                        r="8"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                      <path
                        d="M9 12h6m-3-3v6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      />
                    </svg>
                  </button>
                  {harmonisable && (
                    <button
                      type="button"
                      onClick={() => toggleItemHarmonization(idx)}
                      disabled={isSectionLocked("equip")}
                      style={{
                        borderRadius: 6,
                        border: "1px solid rgba(255,255,255,0.2)",
                        background: harmonized
                          ? "rgba(52, 152, 219, 0.25)"
                          : "rgba(255,255,255,0.08)",
                        color: harmonized ? "#9ed8ff" : "#f5f5f5",
                        cursor: isSectionLocked("equip") ? "not-allowed" : "pointer",
                        fontSize: 12,
                        padding: "2px 6px",
                        fontWeight: 700
                      }}
                      title={harmonized ? "Desharmoniser" : "Harmoniser"}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true">
                        <circle
                          cx="8"
                          cy="12"
                          r="4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                        <circle
                          cx="16"
                          cy="12"
                          r="4"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        />
                      </svg>
                    </button>
                  )}
                  {item.type === "weapon" && (
                    <button
                      type="button"
                      onClick={() => setPrimaryWeapon(idx)}
                      style={{
                        borderRadius: 6,
                        border: "1px solid rgba(255,255,255,0.2)",
                        background: item.isPrimaryWeapon
                          ? "rgba(241, 196, 15, 0.25)"
                          : "rgba(255,255,255,0.08)",
                        color: item.isPrimaryWeapon ? "#f8e58c" : "#f5f5f5",
                        cursor: "pointer",
                        fontSize: 12,
                        padding: "2px 6px",
                        fontWeight: 700
                      }}
                      title="Definir comme arme principale"
                    >
                      ★
                    </button>
                  )}
                  {item.source === "manual" && !isCurrencyItem(item) && (
                    <button
                      type="button"
                      onClick={() => removeManualItem(idx)}
                      style={{
                        padding: "2px 6px",
                        borderRadius: 6,
                        border: "1px solid rgba(255,255,255,0.2)",
                        background: "rgba(231,76,60,0.18)",
                        color: "#f5f5f5",
                        cursor: "pointer",
                        fontSize: 11
                      }}
                    >
                      Retirer
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
      {equipSubTab === "loot" && (
        <div
          style={{
            marginTop: 10,
            borderRadius: 8,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(12,12,18,0.75)",
            padding: 10,
            display: "flex",
            flexDirection: "column",
            gap: 8
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700 }}>Boite a loot infinie</div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
            Ajoutez des items pour tester.
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, marginTop: 4 }}>Armes</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 6
            }}
          >
            {weaponOptions.map(weapon => (
              <button
                key={`loot-weapon-${weapon.id}`}
                type="button"
                onClick={() => addManualItem(`weapon:${weapon.id}`)}
                style={{
                  textAlign: "left",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(10,10,16,0.8)",
                  color: "#f5f5f5",
                  padding: "6px 8px",
                  cursor: "pointer",
                  fontSize: 12
                }}
              >
                <div style={{ fontWeight: 700 }}>
                  + {weapon.name} ({weapon.subtype})
                </div>
                <div style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", marginTop: 2 }}>
                  {formatWeaponSummary(weapon)}
                </div>
              </button>
            ))}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6 }}>Outils</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 6
            }}
          >
            {toolItems.map(tool => (
              <button
                key={`loot-tool-${tool.id}`}
                type="button"
                onClick={() => addManualItem(`tool:${tool.id}`)}
                style={{
                  textAlign: "left",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(10,10,16,0.8)",
                  color: "#f5f5f5",
                  padding: "6px 8px",
                  cursor: "pointer",
                  fontSize: 12
                }}
              >
                + {tool.label}
              </button>
            ))}
            {toolItems.length === 0 && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                Aucun outil disponible.
              </div>
            )}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6 }}>Armures</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 6
            }}
          >
            {armorItems.map(armor => (
              <button
                key={`loot-armor-${armor.id}`}
                type="button"
                onClick={() => addManualItem(`armor:${armor.id}`)}
                style={{
                  textAlign: "left",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(10,10,16,0.8)",
                  color: "#f5f5f5",
                  padding: "6px 8px",
                  cursor: "pointer",
                  fontSize: 12
                }}
              >
                + {armor.label}
              </button>
            ))}
            {armorItems.length === 0 && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                Aucune armure chargee pour l'instant.
              </div>
            )}
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, marginTop: 6 }}>Autres</div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 6
            }}
          >
            {objectItems.map(obj => (
              <button
                key={`loot-object-${obj.id}`}
                type="button"
                onClick={() => addManualItem(`object:${obj.id}`)}
                style={{
                  textAlign: "left",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(10,10,16,0.8)",
                  color: "#f5f5f5",
                  padding: "6px 8px",
                  cursor: "pointer",
                  fontSize: 12
                }}
              >
                + {obj.label}
              </button>
            ))}
            {objectItems.length === 0 && (
              <div style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                Aucun autre item charge pour l'instant.
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

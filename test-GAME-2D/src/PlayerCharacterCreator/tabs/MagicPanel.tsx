import React from "react";
import { MagicTab } from "./MagicTab";

export function MagicPanel(props: {
  magicSources: Array<any>;
  activeMagicTab: number;
  setActiveMagicTab: (value: number) => void;
  isSectionLocked: (id: string) => boolean;
  toggleSectionLock: (id: string) => void;
  lockButtonBaseStyle: React.CSSProperties;
  getLockButtonState: (id: string) => { background: string; label: string };
  spellcastingSelections: Record<string, any>;
  updateSpellcastingSelection: (key: string, value: any) => void;
  computeMod: (value: number) => number;
  getScore: (key: any) => number;
  resolveLevel: () => number;
  getCasterContribution: (progression: "full" | "half" | "third" | "none", level: number) => number;
  resolveItemTags: (value: string) => string[];
  inventoryItems: Array<any>;
  formatEquipmentLabel: (value: string) => string;
  getSpellId: (value: any) => string;
  makeSpellEntry: (value: any) => any;
}): React.JSX.Element {
  const {
    magicSources,
    activeMagicTab,
    setActiveMagicTab,
    isSectionLocked,
    toggleSectionLock,
    lockButtonBaseStyle,
    getLockButtonState,
    spellcastingSelections,
    updateSpellcastingSelection,
    computeMod,
    getScore,
    resolveLevel,
    getCasterContribution,
    resolveItemTags,
    inventoryItems,
    formatEquipmentLabel,
    getSpellId,
    makeSpellEntry
  } = props;

  return (
    <MagicTab
      magicSources={magicSources}
      activeMagicTab={activeMagicTab}
      setActiveMagicTab={setActiveMagicTab}
      isSectionLocked={isSectionLocked}
      toggleSectionLock={toggleSectionLock}
      lockButtonBaseStyle={lockButtonBaseStyle}
      getLockButtonState={getLockButtonState}
      spellcastingSelections={spellcastingSelections}
      updateSpellcastingSelection={updateSpellcastingSelection}
      computeMod={computeMod}
      getScore={getScore}
      resolveLevel={resolveLevel}
      getCasterContribution={getCasterContribution}
      resolveItemTags={resolveItemTags}
      inventoryItems={inventoryItems}
      formatEquipmentLabel={formatEquipmentLabel}
      getSpellId={getSpellId}
      makeSpellEntry={makeSpellEntry}
    />
  );
}

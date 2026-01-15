import React, { useEffect, useMemo, useState } from "react";
import type { ActionAvailability, ActionDefinition } from "../game/actionTypes";
import { RadialWheelMenu, type WheelMenuItem } from "./RadialWheelMenu";

type WheelView = "root" | "categories" | "actions" | "inspect";

function categoryLabel(category: string): string {
  const c = category.toLowerCase();
  if (c === "attack") return "Attaque";
  if (c === "movement") return "Mouvement";
  if (c === "support") return "Support";
  if (c === "defense") return "Defense";
  if (c === "item") return "Objet";
  if (c === "reaction") return "Reaction";
  return category;
}

function categoryColor(category: string): string {
  const c = category.toLowerCase();
  if (c === "attack") return "#e74c3c";
  if (c === "movement") return "#2ecc71";
  if (c === "support") return "#3498db";
  if (c === "defense") return "#9b59b6";
  if (c === "item") return "#f1c40f";
  if (c === "reaction") return "#e67e22";
  return "#7f8c8d";
}

export function ActionWheelMenu(props: {
  open: boolean;
  anchorX: number;
  anchorY: number;
  size?: number;
  canInteractWithBoard: boolean;
  hasCell: boolean;
  selectedPathLength: number;
  isResolvingEnemies: boolean;
  actions: ActionDefinition[];
  computeActionAvailability: (action: ActionDefinition) => ActionAvailability;
  onClose: () => void;
  onEnterMoveMode: () => void;
  onValidateMove: () => void;
  onResetMove: () => void;
  onInspectCell: () => void;
  onLook: () => void;
  onInteract: () => void;
  onHide: () => void;
  onEndTurn: () => void;
  onPickAction: (action: ActionDefinition) => void;
}): React.ReactNode {
  const [view, setView] = useState<WheelView>("root");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const shouldFilterByCategory = props.actions.length > 7;
  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const action of props.actions) set.add(action.category);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [props.actions]);

  useEffect(() => {
    if (!props.open) {
      setView("root");
      setSelectedCategory(null);
    }
  }, [props.open]);

  const items: WheelMenuItem[] = useMemo(() => {
    if (view === "categories") {
      const catItems: WheelMenuItem[] = [
        {
          id: "all",
          label: "Toutes",
          color: "#34495e",
          onSelect: () => {
            setSelectedCategory(null);
            setView("actions");
          }
        },
        ...categories.map(cat => ({
          id: `cat-${cat}`,
          label: categoryLabel(cat),
          color: categoryColor(cat),
          onSelect: () => {
            setSelectedCategory(cat);
            setView("actions");
          }
        }))
      ];
      return catItems;
    }

    if (view === "actions") {
      const filtered = selectedCategory
        ? props.actions.filter(a => a.category === selectedCategory)
        : props.actions;

      return filtered.map(action => {
        const availability = props.computeActionAvailability(action);
        const enabled = availability.enabled;
        return {
          id: `action-${action.id}`,
          label: action.name,
          color: enabled ? "#2ecc71" : "#e74c3c",
          onSelect: () => {
            props.onPickAction(action);
            setView("root");
            setSelectedCategory(null);
          }
        };
      });
    }

    if (view === "inspect") {
      const enabled = props.canInteractWithBoard && props.hasCell;
      const disabledReason = !props.canInteractWithBoard
        ? "Tour joueur requis"
        : !props.hasCell
          ? "Aucune case"
          : "Indisponible";

      return [
        {
          id: "inspect-cell",
          label: "Inspecter (10)",
          color: "#3498db",
          disabled: !enabled,
          disabledReason,
          onSelect: () => {
            props.onInspectCell();
            setView("root");
          }
        },
        {
          id: "look",
          label: "Tourner regard",
          color: "#1abc9c",
          disabled: !enabled,
          disabledReason,
          onSelect: () => {
            props.onLook();
            setView("root");
          }
        }
      ];
    }

    const isMoveAvailable = props.canInteractWithBoard;
    const hasPath = props.selectedPathLength > 0;

    return [
      {
        id: "move",
        label: "Deplacer",
        color: "#2ecc71",
        disabled: !isMoveAvailable,
        disabledReason: "Tour joueur requis",
        onSelect: props.onEnterMoveMode
      },
      {
        id: "action",
        label: "Action",
        color: "#e74c3c",
        disabled: !props.canInteractWithBoard,
        disabledReason: "Tour joueur requis",
        onSelect: () => {
          if (shouldFilterByCategory) {
            setView("categories");
            return;
          }
          setView("actions");
        }
      },
      {
        id: "validate-move",
        label: "Valider",
        color: "#f1c40f",
        disabled: !props.canInteractWithBoard || !hasPath,
        disabledReason: !hasPath ? "Aucun trajet" : "Tour joueur requis",
        onSelect: props.onValidateMove
      },
      {
        id: "reset-move",
        label: "Annuler trajet",
        color: "#e67e22",
        disabled: !props.canInteractWithBoard || !hasPath,
        disabledReason: !hasPath ? "Aucun trajet" : "Tour joueur requis",
        onSelect: props.onResetMove
      },
      {
        id: "inspect",
        label: "Inspecter",
        color: "#3498db",
        disabled: !props.hasCell || !props.canInteractWithBoard,
        disabledReason: !props.canInteractWithBoard ? "Tour joueur requis" : "Aucune case",
        onSelect: () => setView("inspect")
      },
      {
        id: "interact",
        label: "Interagir",
        color: "#9b59b6",
        disabled: !props.canInteractWithBoard,
        disabledReason: "Tour joueur requis",
        onSelect: props.onInteract
      },
      {
        id: "hide",
        label: "Se cacher",
        color: "#34495e",
        disabled: !props.canInteractWithBoard,
        disabledReason: "Tour joueur requis",
        onSelect: props.onHide
      },
      {
        id: "end-turn",
        label: "Fin tour",
        color: "#ff7f50",
        disabled: !props.canInteractWithBoard || props.isResolvingEnemies,
        disabledReason: props.isResolvingEnemies ? "Tour des ennemis en cours" : "Tour joueur requis",
        onSelect: props.onEndTurn
      }
    ];
  }, [
    categories,
    props,
    selectedCategory,
    shouldFilterByCategory,
    view
  ]);

  const { centerLabel, onCenterClick } = useMemo(() => {
    if (view === "root") {
      return { centerLabel: "Annuler", onCenterClick: props.onClose };
    }
    if (view === "categories") {
      return { centerLabel: "Retour", onCenterClick: () => setView("root") };
    }
    if (view === "inspect") {
      return { centerLabel: "Retour", onCenterClick: () => setView("root") };
    }
    if (view === "actions" && shouldFilterByCategory) {
      return { centerLabel: "Retour", onCenterClick: () => setView("categories") };
    }
    return { centerLabel: "Retour", onCenterClick: () => setView("root") };
  }, [props.onClose, shouldFilterByCategory, view]);

  return (
    <RadialWheelMenu
      open={props.open}
      anchorX={props.anchorX}
      anchorY={props.anchorY}
      items={items}
      onClose={props.onClose}
      size={props.size}
      centerLabel={centerLabel}
      onCenterClick={onCenterClick}
      sliceOpacity={0.65}
      centerOpacity={0.6}
    />
  );
}

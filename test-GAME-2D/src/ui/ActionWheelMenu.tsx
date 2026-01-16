import React, { useEffect, useMemo, useState } from "react";
import type { ActionAvailability, ActionDefinition } from "../game/actionTypes";
import type { MovementModeDefinition } from "../game/movementModes";
import { RadialWheelMenu, type WheelMenuItem } from "./RadialWheelMenu";

type WheelView =
  | "root"
  | "categories"
  | "actions"
  | "inspect"
  | "movement"
  | "interaction-select"
  | "interaction-actions";

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
  movementModes: MovementModeDefinition[];
  activeMovementModeId: string | null;
  isMoving: boolean;
  interactionState: "idle" | "select" | "menu";
  interactionItems: WheelMenuItem[];
  interactionPrompt?: string;
  onCancelInteract: () => void;
  computeActionAvailability: (action: ActionDefinition) => ActionAvailability;
  onClose: () => void;
  onSelectMoveMode: (modeId: string) => void;
  onCancelMove: () => void;
  onNoMovementModes: () => void;
  onNoActions: () => void;
  onValidateMove: () => void;
  onInspectCell: () => void;
  onLook: () => void;
  onInteract: () => void;
  onHide: () => void;
  onEndTurn: () => void;
  onPickAction: (action: ActionDefinition) => void;
  sliceOpacity?: number;
  centerOpacity?: number;
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

  useEffect(() => {
    if (props.interactionState === "select") {
      setView("interaction-select");
      return;
    }
    if (props.interactionState === "menu") {
      setView("interaction-actions");
      return;
    }
    if (view === "interaction-select" || view === "interaction-actions") {
      setView("root");
    }
  }, [props.interactionState, view]);

  const items: WheelMenuItem[] = useMemo(() => {
    if (view === "interaction-select") {
      return [
        {
          id: "interaction-select",
          label: "Selection",
          color: "#34495e",
          disabled: true,
          disabledReason: "Selection en cours"
        }
      ];
    }

    if (view === "interaction-actions") {
      return props.interactionItems;
    }

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
      if (props.actions.length === 0) {
        props.onNoActions();
        setView("root");
        return [];
      }
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
          label: "Inspecter",
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

    if (view === "movement") {
      const hasPath = props.selectedPathLength > 0;
      const moveItems: WheelMenuItem[] = props.movementModes.map(mode => {
        const isActive = mode.id === props.activeMovementModeId;
        return {
          id: `move-${mode.id}`,
          label: mode.label,
          color: isActive ? "#2ecc71" : "#34495e",
          onSelect: () => {
            props.onSelectMoveMode(mode.id);
          }
        };
      });

      moveItems.push({
        id: "validate-move",
        label: "Valider trajet",
        color: "#f1c40f",
        disabled: !props.canInteractWithBoard || !hasPath,
        disabledReason: !hasPath ? "Aucun trajet" : "Tour joueur requis",
        onSelect: props.onValidateMove
      });

      return moveItems;
    }

    const isMoveAvailable = props.canInteractWithBoard;

    return [
      {
        id: "move",
        label: "Deplacer",
        color: "#2ecc71",
        disabled: !isMoveAvailable,
        disabledReason: "Tour joueur requis",
        onSelect: () => {
          if (props.movementModes.length === 0) {
            props.onNoMovementModes();
            return;
          }
          setView("movement");
        }
      },
      {
        id: "action",
        label: "Action",
        color: "#e74c3c",
        disabled: !props.canInteractWithBoard,
        disabledReason: "Tour joueur requis",
        onSelect: () => {
          if (props.actions.length === 0) {
            props.onNoActions();
            return;
          }
          if (shouldFilterByCategory) {
            setView("categories");
            return;
          }
          setView("actions");
        }
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
      return { centerLabel: "Annuler", onCenterClick: () => setView("root") };
    }
    if (view === "inspect") {
      return { centerLabel: "Annuler", onCenterClick: () => setView("root") };
    }
    if (view === "movement") {
      return {
        centerLabel: "Annuler",
        onCenterClick: () => {
          props.onCancelMove();
          setView("root");
        }
      };
    }
    if (view === "interaction-select" || view === "interaction-actions") {
      return {
        centerLabel: "Annuler",
        onCenterClick: () => {
          props.onCancelInteract();
          setView("root");
        }
      };
    }
    if (view === "actions" && shouldFilterByCategory) {
      return { centerLabel: "Annuler", onCenterClick: () => setView("root") };
    }
    return { centerLabel: "Annuler", onCenterClick: () => setView("root") };
  }, [props.onCancelInteract, props.onCancelMove, props.onClose, shouldFilterByCategory, view]);

  const sliceOpacity =
    typeof props.sliceOpacity === "number"
      ? props.sliceOpacity
      : props.isMoving
        ? 0.28
        : 0.65;
  const centerOpacity =
    typeof props.centerOpacity === "number"
      ? props.centerOpacity
      : props.isMoving
        ? 0.35
        : 0.6;

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
      sliceOpacity={sliceOpacity}
      centerOpacity={centerOpacity}
      arcLabel={view === "interaction-select" ? props.interactionPrompt : undefined}
    />
  );
}

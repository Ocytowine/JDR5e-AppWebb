import React, { useEffect, useRef, useState } from "react";
import { Application, Container, Graphics, Sprite, Assets } from "pixi.js";
import { sampleCharacter } from "./sampleCharacter";
import type { TokenState } from "./types";
import gentilSvg from "../model/gentil.svg";
import mechantSvg from "../model/mechant.svg";

const GRID_COLS = 12;
const GRID_ROWS = 8;
const TILE_SIZE = 64;
const BOARD_WIDTH = GRID_COLS * TILE_SIZE;
const BOARD_HEIGHT = GRID_ROWS * TILE_SIZE;

function createEnemy(id: number): TokenState {
  const x = GRID_COLS - 1;
  const y = id;
  return {
    id: `enemy-${id}`,
    type: "enemy",
    x,
    y,
    hp: 6,
    maxHp: 6
  };
}

export const GameBoard: React.FC = () => {
  const pixiContainerRef = useRef<HTMLDivElement | null>(null);
  const appRef = useRef<Application | null>(null);
  const tokenLayerRef = useRef<Container | null>(null);
  const pathLayerRef = useRef<Graphics | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const [player, setPlayer] = useState<TokenState>({
    id: "player-1",
    type: "player",
    x: 0,
    y: Math.floor(GRID_ROWS / 2),
    hp: sampleCharacter.pvActuels,
    maxHp: sampleCharacter.pvMax
  });

  const [enemies, setEnemies] = useState<TokenState[]>([
    createEnemy(1),
    createEnemy(3),
    createEnemy(5)
  ]);

  const [selectedPath, setSelectedPath] = useState<{ x: number; y: number }[]>([]);

  function pushLog(message: string) {
    setLog(prev => [message, ...prev].slice(0, 10));
  }

  function handleBoardClick(event: React.MouseEvent<HTMLDivElement>) {
    const container = pixiContainerRef.current;
    if (!container) return;

    const canvas = container.querySelector("canvas");
    if (!canvas) return;

    const bounds = canvas.getBoundingClientRect();
    const localX = event.clientX - bounds.left;
    const localY = event.clientY - bounds.top;

    const targetX = Math.max(
      0,
      Math.min(GRID_COLS - 1, Math.floor((localX / bounds.width) * GRID_COLS))
    );
    const targetY = Math.max(
      0,
      Math.min(GRID_ROWS - 1, Math.floor((localY / bounds.height) * GRID_ROWS))
    );

    setSelectedPath(prev => {
      const path = [...prev];
      // Point de départ : position actuelle du joueur
      let current =
        path.length > 0 ? path[path.length - 1] : { x: player.x, y: player.y };

      if (current.x === targetX && current.y === targetY) return path;

      let cx = current.x;
      let cy = current.y;

      // On ajoute chaque case traversée (déplacement en grille, horizontal puis vertical)
      while (cx !== targetX) {
        cx += Math.sign(targetX - cx);
        path.push({ x: cx, y: cy });
      }
      while (cy !== targetY) {
        cy += Math.sign(targetY - cy);
        path.push({ x: cx, y: cy });
      }

      return path;
    });

    pushLog(`Trajectoire: ajout de la case (${targetX}, ${targetY}).`);
  }

  function stepEnemyAI() {
    setEnemies(prevEnemies =>
      prevEnemies.map(enemy => {
        let dx = 0;
        let dy = 0;
        if (enemy.x < player.x) dx = 1;
        else if (enemy.x > player.x) dx = -1;
        if (enemy.y < player.y) dy = 1;
        else if (enemy.y > player.y) dy = -1;

        const newX = enemy.x + dx;
        const newY = enemy.y + dy;

        if (newX === player.x && newY === player.y) {
          const damage = 2;
          setPlayer(prev => ({
            ...prev,
            hp: Math.max(0, prev.hp - damage)
          }));
          pushLog(`${enemy.id} attaque le joueur pour ${damage} degats.`);
          return { ...enemy, x: newX, y: newY };
        }

        return {
          ...enemy,
          x: Math.max(0, Math.min(GRID_COLS - 1, newX)),
          y: Math.max(0, Math.min(GRID_ROWS - 1, newY))
        };
      })
    );
  }

  function handleValidatePath() {
    if (selectedPath.length === 0) return;
    const last = selectedPath[selectedPath.length - 1];
    setPlayer(prev => ({
      ...prev,
      x: last.x,
      y: last.y
    }));
    pushLog(
      `Déplacement validé vers (${last.x}, ${last.y}) via ${
        selectedPath.length
      } étape(s).`
    );
    setSelectedPath([]);
  }

  function handleResetPath() {
    setSelectedPath([]);
    pushLog("Trajectoire réinitialisée.");
  }

  // Initialisation Pixi (v8) avec Application.init
  useEffect(() => {
    if (!pixiContainerRef.current || appRef.current) return;

    const app = new Application();
    appRef.current = app;

    let destroyed = false;
    let resizeHandler: (() => void) | null = null;
    let initialized = false;

    const initPixi = async () => {
      await app.init({
        width: BOARD_WIDTH,
        height: BOARD_HEIGHT,
        background: "#1c1b29",
        antialias: true
      });

      initialized = true;

      // Précharger les SVG pour éviter les warnings d'Assets
      await Assets.load([gentilSvg, mechantSvg]);

      if (destroyed) return;

      const container = pixiContainerRef.current;
      if (!container) return;

      container.appendChild(app.canvas);

      const root = new Container();
      app.stage.addChild(root);

      const gridLayer = new Graphics();
      root.addChild(gridLayer);

      const pathLayer = new Graphics();
      root.addChild(pathLayer);
      pathLayerRef.current = pathLayer;

      const tokenLayer = new Container();
      root.addChild(tokenLayer);
      tokenLayerRef.current = tokenLayer;

      const drawGrid = () => {
        gridLayer.clear();
        // Fond légèrement contrasté pour les cases (API Pixi v8)
        for (let y = 0; y < GRID_ROWS; y++) {
          for (let x = 0; x < GRID_COLS; x++) {
            const isDark = (x + y) % 2 === 0;
            gridLayer
              .rect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE)
              .fill({
                color: isDark ? 0x151522 : 0x1d1d30,
                alpha: 1
              });
          }
        }

        // Lignes de grille très visibles
        gridLayer.setStrokeStyle({
          width: 2,
          color: 0xaaaaaa,
          alpha: 0.9
        });
        for (let x = 0; x <= GRID_COLS; x++) {
          gridLayer.moveTo(x * TILE_SIZE, 0);
          gridLayer.lineTo(x * TILE_SIZE, BOARD_HEIGHT);
        }
        for (let y = 0; y <= GRID_ROWS; y++) {
          gridLayer.moveTo(0, y * TILE_SIZE);
          gridLayer.lineTo(BOARD_WIDTH, y * TILE_SIZE);
        }

        gridLayer.stroke();
      };

      drawGrid();

      const resize = () => {
        const canvas = app.canvas;
        const parent = canvas.parentElement;
        if (!parent) return;
        const scale = Math.min(
          parent.clientWidth / BOARD_WIDTH,
          parent.clientHeight / BOARD_HEIGHT
        );
        canvas.style.transformOrigin = "top left";
        canvas.style.transform = `scale(${scale})`;
      };

      resizeHandler = resize;
      resize();
      window.addEventListener("resize", resize);

      app.ticker.add((delta) => {
        const dt = delta / 60;
        if (dt > 0 && Math.random() < 0.02) {
          stepEnemyAI();
        }
      });
    };

    void initPixi();

    return () => {
      destroyed = true;
      if (resizeHandler) {
        window.removeEventListener("resize", resizeHandler);
      }
      // Ne détruire l'application que si elle a été initialisée
      if (initialized && !app.destroyed) {
        app.destroy(true);
      }
      appRef.current = null;
      tokenLayerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redessin des tokens quand l'état change
  useEffect(() => {
    const tokenLayer = tokenLayerRef.current;
    if (!tokenLayer) return;

    tokenLayer.removeChildren();

    const allTokens: TokenState[] = [player, ...enemies];
    for (const token of allTokens) {
      const textureUrl = token.type === "player" ? gentilSvg : mechantSvg;

      // Conteneur pour associer fond coloré + sprite SVG
      const tokenContainer = new Container();

      const color = token.type === "player" ? 0x2ecc71 : 0xe74c3c;
      const base = new Graphics()
        .circle(0, 0, TILE_SIZE * 0.4)
        .fill({ color, alpha: 0.9 });
      tokenContainer.addChild(base);

      const sprite = Sprite.from(textureUrl);
      sprite.anchor.set(0.5);
      sprite.width = TILE_SIZE * 0.7;
      sprite.height = TILE_SIZE * 0.7;
      sprite.tint = 0xffffff; // garder le SVG lisible
      tokenContainer.addChild(sprite);

      tokenContainer.x = token.x * TILE_SIZE + TILE_SIZE / 2;
      tokenContainer.y = token.y * TILE_SIZE + TILE_SIZE / 2;

      tokenLayer.addChild(tokenContainer);
    }
  }, [player, enemies]);

  // Dessin de la trajectoire choisie
  useEffect(() => {
    const pathLayer = pathLayerRef.current;
    if (!pathLayer) return;

    pathLayer.clear();

    if (selectedPath.length === 0) return;

    // Trajectoire très visible (couleur vive et épaisseur)
    pathLayer.setStrokeStyle({
      width: 6,
      color: 0xf1c40f,
      alpha: 1
    });

    const startX = player.x * TILE_SIZE + TILE_SIZE / 2;
    const startY = player.y * TILE_SIZE + TILE_SIZE / 2;
    pathLayer.moveTo(startX, startY);

    for (const node of selectedPath) {
      const px = node.x * TILE_SIZE + TILE_SIZE / 2;
      const py = node.y * TILE_SIZE + TILE_SIZE / 2;
      pathLayer.lineTo(px, py);
    }

    pathLayer.stroke();
  }, [player, selectedPath]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        gap: "16px",
        height: "100vh",
        background: "#0b0b12",
        color: "#f5f5f5",
        fontFamily: "system-ui, sans-serif",
        padding: "16px",
        boxSizing: "border-box"
      }}
    >
      <div
        style={{
          flex: "1 1 auto",
          display: "flex",
          flexDirection: "column",
          alignItems: "stretch",
          justifyContent: "center"
        }}
      >
        <h1 style={{ marginBottom: 8 }}>Mini Donjon (test-GAME)</h1>
        <p style={{ marginBottom: 8 }}>
          Cliquez sur la grille pour deplacer le personnage (jeton vert). Les
          ennemis (rouge) se rapprochent automatiquement.
        </p>
        <div
          ref={pixiContainerRef}
          onClick={handleBoardClick}
          style={{
            flex: "1 1 auto",
            border: "1px solid #333",
            overflow: "hidden",
            maxHeight: "min(80vh, 640px)",
            maxWidth: "min(100%, 1024px)"
          }}
        />
        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={handleValidatePath}
            style={{
              padding: "4px 8px",
              background: selectedPath.length ? "#2ecc71" : "#555",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: selectedPath.length ? "pointer" : "default"
            }}
            disabled={selectedPath.length === 0}
          >
            Valider le déplacement
          </button>
          <button
            type="button"
            onClick={handleResetPath}
            style={{
              padding: "4px 8px",
              background: "#e67e22",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: "pointer"
            }}
          >
            Réinitialiser
          </button>
        </div>
      </div>

      <div
        style={{
          width: "320px",
          display: "flex",
          flexDirection: "column",
          gap: "12px"
        }}
      >
        <section
          style={{
            padding: "8px 12px",
            background: "#141421",
            borderRadius: 8,
            border: "1px solid #333"
          }}
        >
          <h2 style={{ margin: "0 0 8px" }}>Personnage</h2>
          <div><strong>Nom :</strong> {sampleCharacter.nom.nomcomplet}</div>
          <div>
            <strong>Niveau :</strong> {sampleCharacter.niveauGlobal} |{" "}
            <strong>Classe :</strong> {sampleCharacter.classe[1].classeId}
          </div>
          <div>
            <strong>PV :</strong> {player.hp} / {player.maxHp}
          </div>
          <div>
            <strong>CA :</strong> {sampleCharacter.CA}
          </div>
          <div style={{ marginTop: 8 }}>
            <strong>Caracs :</strong>{" "}
            FOR {sampleCharacter.caracs.force.FOR} | DEX{" "}
            {sampleCharacter.caracs.dexterite.DEX} | CON{" "}
            {sampleCharacter.caracs.constitution.CON}
          </div>
          <div style={{ marginTop: 8, fontSize: 12 }}>
            <strong>Trajectoire :</strong>{" "}
            {selectedPath.length === 0
              ? "aucune"
              : `(${player.x}, ${player.y}) -> ` +
                selectedPath
                  .map(node => `(${node.x}, ${node.y})`)
                  .join(" -> ")}
          </div>
        </section>

        <section
          style={{
            padding: "8px 12px",
            background: "#141421",
            borderRadius: 8,
            border: "1px solid #333",
            flex: "1 1 auto",
            display: "flex",
            flexDirection: "column"
          }}
        >
          <h2 style={{ margin: "0 0 8px" }}>Log</h2>
          <div
            style={{
              flex: "1 1 auto",
              overflowY: "auto",
              fontSize: 12,
              lineHeight: 1.4
            }}
          >
            {log.map((line, idx) => (
              <div key={idx}>• {line}</div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

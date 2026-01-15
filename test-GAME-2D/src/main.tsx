import React from "react";
import ReactDOM from "react-dom/client";
import { GameBoard } from "./GameBoard";

const rootElement = document.getElementById("root") as HTMLElement;

ReactDOM.createRoot(rootElement).render(<GameBoard />);

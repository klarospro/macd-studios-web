import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { Side } from "../domain/types";

/** Posición que el runner mantiene abierta en la demo, por instrumento. */
export interface HeldPosition {
  contractId: string;
  side: Side;
  entryPrice: number;
  stopPrice: number;
  size: number;
  riskAmount: number;
  openedAt: string;
}

export type OpenState = Record<string, HeldPosition>; // clave = nombre del instrumento

export function loadState(path: string): OpenState {
  if (!existsSync(path)) return {};
  return JSON.parse(readFileSync(path, "utf8")) as OpenState;
}

export function saveState(path: string, state: OpenState): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(state, null, 2));
}

/** Registro append-only de la curva de equity (para el dashboard). */
export function appendEquity(path: string, equity: number): void {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify({ at: new Date().toISOString(), equity })}\n`);
}

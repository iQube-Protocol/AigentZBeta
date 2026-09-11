/**
 * marketSessionController — the ONE shared, client-side market session
 * every representation of MoneyPenny's market console subscribes to
 * (2026-09-04 tranche: "shared market-session controller consumed by
 * inline, capsule and HFTConsole representations").
 *
 * A plain module-level singleton store (not React Context) — deliberately,
 * so it is shared regardless of where in the component tree a consumer
 * mounts (a copilot capsule and `HFTConsole.tsx`'s panel are not
 * necessarily under a common ancestor). Exposed to React via
 * `useSyncExternalStore`, which is what makes "the same session survives
 * compact → expanded → panel" a structural property rather than a
 * convention every mount point has to remember to honor:
 *
 *   - the interval that ticks the simulation starts on the FIRST subscriber
 *     and stops on the LAST unsubscribe — so two representations mounted at
 *     once (e.g. a capsule left open while HFTConsole is also visible)
 *     never start a second competing interval;
 *   - state (ring buffers, accumulated result, filters) is never reset by a
 *     subscribe/unsubscribe transition — only `restart()` (an explicit
 *     operator action) resets it;
 *   - `getSnapshot()` returns the SAME object reference until the state
 *     actually changes, satisfying `useSyncExternalStore`'s contract and
 *     letting a `===` check prove "no one silently rebuilt the session".
 *
 * Every value is deterministic and simulation-labelled, sourced from
 * services/moneypenny/marketSimulation.ts — this controller adds no RNG of
 * its own, it only sequences the SAME primitives HFTConsole.tsx and the
 * chat-route snapshot builders in services/smarttriad/mediaProviders.ts use.
 */

'use client';

import { useSyncExternalStore } from 'react';
import {
  marketSimulationChains,
  quoteFills,
  simulateCaptureHistory,
  simulateEdge,
  simulateFillFromQuote,
  simulateInventory,
  simulateQuote,
  timeBucket,
  type SimulatedEdge,
  type SimulatedFill,
  type SimulatedInventory,
  type SimulatedQuote,
} from './marketSimulation';

export type MarketSessionQuote = SimulatedQuote & { timestamp: string };
export type MarketSessionFill = SimulatedFill & { timestamp: string };

export interface MarketSessionState {
  chains: string[];
  connected: boolean;
  quotes: MarketSessionQuote[];
  fills: MarketSessionFill[];
  captureHistory: number[];
  accumulatedQc: number;
  edge: SimulatedEdge;
  inventory: SimulatedInventory;
  /** Bumps only on `restart()` — a consumer can detect an explicit reset
   *  without it being confused with an ordinary tick. */
  generation: number;
}

const QUOTE_BUFFER = 20;
const FILL_BUFFER = 30;
const HISTORY_BUFFER = 30;
const TICK_MS = 1000;

function initState(generation = 0): MarketSessionState {
  const seeded = simulateCaptureHistory(HISTORY_BUFFER);
  return {
    chains: marketSimulationChains(),
    connected: false,
    quotes: [],
    fills: [],
    captureHistory: seeded.map((p) => p.captureBps),
    accumulatedQc: 0,
    edge: simulateEdge(),
    inventory: simulateInventory(),
    generation,
  };
}

let state: MarketSessionState = initState();
const subscribers = new Set<() => void>();
let intervalHandle: ReturnType<typeof setInterval> | null = null;

function emit(): void {
  subscribers.forEach((cb) => cb());
}

function tick(): void {
  const bucket = timeBucket();
  const chain = state.chains[bucket % state.chains.length];
  const timestamp = new Date().toISOString();
  const quote: MarketSessionQuote = { ...simulateQuote(chain, bucket), timestamp };
  const nextQuotes = [quote, ...state.quotes].slice(0, QUOTE_BUFFER);

  let nextFills = state.fills;
  let nextAccumulated = state.accumulatedQc;
  let nextHistory = state.captureHistory;
  if (quoteFills(quote)) {
    const fill: MarketSessionFill = { ...simulateFillFromQuote(quote), timestamp };
    nextFills = [fill, ...state.fills].slice(0, FILL_BUFFER);
    nextAccumulated = state.accumulatedQc + Math.max(0, fill.captureBps) * 4.17;
    nextHistory = [...state.captureHistory, fill.captureBps].slice(-HISTORY_BUFFER);
  }

  state = {
    ...state,
    quotes: nextQuotes,
    fills: nextFills,
    accumulatedQc: nextAccumulated,
    captureHistory: nextHistory,
    edge: simulateEdge(),
    inventory: simulateInventory(),
  };
  emit();
}

/**
 * `useSyncExternalStore`'s subscribe function — starts the shared interval
 * on the first subscriber, stops it on the last. Never called directly by
 * consumers; use `useMoneyPennyMarketSession()`.
 */
export function subscribeMarketSession(callback: () => void): () => void {
  subscribers.add(callback);
  if (subscribers.size === 1 && !intervalHandle) {
    state = { ...state, connected: true };
    intervalHandle = setInterval(tick, TICK_MS);
  }
  return () => {
    subscribers.delete(callback);
    if (subscribers.size === 0 && intervalHandle) {
      clearInterval(intervalHandle);
      intervalHandle = null;
      state = { ...state, connected: false };
    }
  };
}

export function getMarketSessionSnapshot(): MarketSessionState {
  return state;
}

/** Server snapshot for `useSyncExternalStore`'s third argument — this
 *  session is client-only UI (matches HFTConsole.tsx's existing "use
 *  client" scope), so it returns the same shape without ticking. */
export function getMarketSessionServerSnapshot(): MarketSessionState {
  return state;
}

/** Explicit operator action — the ONLY thing that resets ring buffers/
 *  accumulated result. A subscribe/unsubscribe transition never does this. */
export function restartMarketSession(): void {
  const wasRunning = intervalHandle !== null;
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
  state = initState(state.generation + 1);
  if (wasRunning || subscribers.size > 0) {
    state = { ...state, connected: true };
    intervalHandle = setInterval(tick, TICK_MS);
  }
  emit();
}

/** Test-only reset — restores true module-singleton behavior between test
 *  cases without leaking a running interval across them. Not exported for
 *  application use. */
export function __resetMarketSessionForTests(): void {
  if (intervalHandle) clearInterval(intervalHandle);
  intervalHandle = null;
  subscribers.clear();
  state = initState();
}

/**
 * The ONE hook every representation (inline capsule, expanded modal,
 * `HFTConsole.tsx`'s panel) calls. Two components calling this
 * simultaneously share the SAME session — proven by `getMarketSessionSnapshot()`
 * returning the identical object reference to both.
 */
export function useMoneyPennyMarketSession(): MarketSessionState {
  return useSyncExternalStore(subscribeMarketSession, getMarketSessionSnapshot, getMarketSessionServerSnapshot);
}

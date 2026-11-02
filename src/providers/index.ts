import type { Provider, ProviderId } from "../types.js";
import { claudeCode } from "./claude-code/index.js";

/** Add new providers (Codex, Cursor, …) here. */
export const PROVIDERS: Record<ProviderId, Provider> = {
  "claude-code": claudeCode,
};

export function getProvider(id: string): Provider | undefined {
  return (PROVIDERS as Record<string, Provider>)[id];
}

import { browser } from "wxt/browser";
import { DEFAULT_SETTINGS, type Settings } from "../../types/settings";
import { STORAGE_KEYS } from "./keys";

export async function getSettings(): Promise<Settings> {
  const result = await browser.storage.local.get(STORAGE_KEYS.settings);
  const stored = result[STORAGE_KEYS.settings] as Partial<Settings> | undefined;
  return { ...DEFAULT_SETTINGS, ...(stored || {}) };
}

export async function updateSettings(fields: Partial<Settings>): Promise<Settings> {
  const current = await getSettings();
  const next = { ...current, ...fields };
  await browser.storage.local.set({ [STORAGE_KEYS.settings]: next });
  return next;
}

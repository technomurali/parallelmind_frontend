import type { ExtensionEntry } from "./extensionTypes";

const extensionEntries = import.meta.glob("./*/entry.ts");

const resolveEntry = async (extensionId: string): Promise<ExtensionEntry | null> => {
  const key = `./${extensionId}/entry.ts`;
  const loader = extensionEntries[key];
  if (!loader) return null;
  const mod = await loader();
  const entry = (mod as { default?: ExtensionEntry }).default ?? (mod as ExtensionEntry);
  if (!entry || typeof entry !== "object") return null;
  return entry;
};

export const runExtensionAction = async (
  extensionId: string,
  actionId: string
): Promise<void> => {
  try {
    const entry = await resolveEntry(extensionId);
    if (!entry) {
      console.warn(`[extensions] Missing entry for ${extensionId}`);
      return;
    }
    const action = entry.actions?.[actionId];
    if (typeof action !== "function") {
      console.warn(`[extensions] Missing action ${actionId} for ${extensionId}`);
      return;
    }
    await action();
  } catch (error) {
    console.error(`[extensions] Failed to run ${extensionId}:${actionId}`, error);
  }
};

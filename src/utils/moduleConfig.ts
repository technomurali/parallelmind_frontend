import modulesConfig from "../../parallelmind_modules.yml?raw";

type ModuleKey = "cognitiveNotes";

type ModuleFlags = Record<ModuleKey, boolean>;

const defaultFlags: ModuleFlags = {
  cognitiveNotes: false,
};

const parseBoolean = (value: string): boolean | null => {
  const normalized = value.trim().toLowerCase();
  if (["true", "yes", "1", "on"].includes(normalized)) return true;
  if (["false", "no", "0", "off"].includes(normalized)) return false;
  return null;
};

const parseModulesConfig = (raw: string): ModuleFlags => {
  const flags: ModuleFlags = { ...defaultFlags };
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.replace(/#.*/, "").trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^([A-Za-z0-9_-]+)\s*:\s*(.+)$/);
    if (!match) continue;
    const key = match[1] as ModuleKey;
    if (!(key in flags)) continue;
    const boolValue = parseBoolean(match[2]);
    if (boolValue !== null) {
      flags[key] = boolValue;
    }
  }
  return flags;
};

const cachedFlags = parseModulesConfig(modulesConfig ?? "");

export const isModuleEnabled = (moduleKey: ModuleKey): boolean => {
  return cachedFlags[moduleKey] ?? false;
};

import { FileManager } from "../../data/fileManager";
import type { ExtensionEntry } from "../extensionTypes";

type CognitiveNotesIndex = {
  schema_version: "0.1.0";
  root_name: string;
  created_on: string;
};

const fileManager = new FileManager();

const nowIso = (): string => new Date().toISOString();

const baseNameFromPath = (dirPath: string): string => {
  const trimmed = dirPath.replace(/[\\/]+$/, "");
  const parts = trimmed.split(/[\\/]/);
  return parts[parts.length - 1] || trimmed;
};

const joinPath = (dirPath: string, fileName: string): string => {
  const trimmed = dirPath.replace(/[\\/]+$/, "");
  const sep = trimmed.includes("\\") ? "\\" : "/";
  return `${trimmed}${sep}${fileName}`;
};

const buildFileName = (rootName: string): string => {
  const trimmed = (rootName ?? "").trim();
  return `${trimmed || "root"}_cognitiveNotes.json`;
};

const buildPayload = (rootName: string): string => {
  const payload: CognitiveNotesIndex = {
    schema_version: "0.1.0",
    root_name: rootName,
    created_on: nowIso(),
  };
  return JSON.stringify(payload, null, 2);
};

const createFromHandle = async (
  dirHandle: FileSystemDirectoryHandle
): Promise<void> => {
  const fileName = buildFileName(dirHandle.name);
  try {
    await dirHandle.getFileHandle(fileName, { create: false });
    return;
  } catch (err) {
    if (!(err instanceof DOMException && err.name === "NotFoundError")) {
      throw err;
    }
  }
  const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
  const writable = await (fileHandle as any).createWritable?.();
  if (!writable) {
    throw new Error("Unable to create cognitive notes file.");
  }
  await writable.write(buildPayload(dirHandle.name));
  await writable.close();
};

const createFromPath = async (dirPath: string): Promise<void> => {
  const rootName = baseNameFromPath(dirPath);
  const fileName = buildFileName(rootName);
  const filePath = joinPath(dirPath, fileName);
  const { exists, writeTextFile } = await import("@tauri-apps/plugin-fs");
  if (await exists(filePath)) return;
  await writeTextFile(filePath, buildPayload(rootName), { create: true });
};

const openCognitiveNotes = async (): Promise<void> => {
  let selection: FileSystemDirectoryHandle | string | null = null;
  try {
    selection = await fileManager.pickRootDirectory();
  } catch (err) {
    console.error("[CognitiveNotes] pickRootDirectory failed:", err);
    return;
  }
  if (!selection) return;
  try {
    if (typeof selection === "string") {
      await createFromPath(selection);
    } else {
      await createFromHandle(selection);
    }
  } catch (err) {
    console.error("[CognitiveNotes] Failed to create index file:", err);
  }
};

const entry: ExtensionEntry = {
  id: "cognitiveNotes",
  actions: {
    open: openCognitiveNotes,
  },
};

export default entry;
export { openCognitiveNotes };

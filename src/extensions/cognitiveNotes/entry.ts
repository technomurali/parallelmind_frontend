import type { ExtensionEntry } from "../extensionTypes";
import { CognitiveNotesManager } from "./data/cognitiveNotesManager";

const cognitiveNotesManager = new CognitiveNotesManager();

const openCognitiveNotes = async (): Promise<void> => {
  let selection: FileSystemDirectoryHandle | string | null = null;
  try {
    selection = await cognitiveNotesManager.pickRootDirectory();
  } catch (err) {
    console.error("[CognitiveNotes] pickRootDirectory failed:", err);
    return;
  }
  if (!selection) return;
  try {
    if (typeof selection === "string") {
      await cognitiveNotesManager.loadOrCreateCognitiveNotesJsonFromPath(selection);
    } else {
      await cognitiveNotesManager.loadOrCreateCognitiveNotesJson(selection);
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

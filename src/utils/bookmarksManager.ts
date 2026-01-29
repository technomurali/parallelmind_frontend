import { loadAppDataDirectoryHandle } from "./appDataHandleStore";
import type { AppSettings } from "../store/mindMapStore";

export const BOOKMARKS_FILE_NAME = "parallelmind.json" as const;
export const BOOKMARKS_SCHEMA_VERSION = "1.1.0" as const;
export const PARALLELMIND_ROOT_SUFFIX = "_rootIndex.json" as const;
export const COGNITIVE_NOTES_SUFFIX = "_cognitiveNotes.json" as const;

export type BookmarkIndexType = "rootIndex" | "cognitiveNotes";

export type BookmarkEntry = {
  path: string;
  name: string;
  moduleType: "parallelmind" | "cognitiveNotes";
  indexType: BookmarkIndexType;
  views: number;
  lastOpened: string;
};

export type BookmarkFile = {
  schema_version: typeof BOOKMARKS_SCHEMA_VERSION;
  bookmarks: BookmarkEntry[];
};

const defaultBookmarks = (): BookmarkFile => ({
  schema_version: BOOKMARKS_SCHEMA_VERSION,
  bookmarks: [],
});

const nowIso = () => new Date().toISOString();

const joinPath = (dirPath: string, fileName: string): string => {
  const trimmed = (dirPath ?? "").replace(/[\\/]+$/, "");
  if (!trimmed) return fileName;
  const sep = trimmed.includes("\\") ? "\\" : "/";
  return `${trimmed}${sep}${fileName}`;
};

export const getRootIndexFileName = (
  moduleType: "parallelmind" | "cognitiveNotes",
  rootName: string
): string => {
  const safeName = (rootName ?? "").trim() || "root";
  return moduleType === "cognitiveNotes"
    ? `${safeName}${COGNITIVE_NOTES_SUFFIX}`
    : `${safeName}${PARALLELMIND_ROOT_SUFFIX}`;
};

export const getRootIndexFilePath = (
  moduleType: "parallelmind" | "cognitiveNotes",
  rootName: string,
  rootPath: string | null
): string => {
  const fileName = getRootIndexFileName(moduleType, rootName);
  return rootPath ? joinPath(rootPath, fileName) : fileName;
};

const normalizeBookmarks = (raw: any): BookmarkFile => {
  if (!raw || typeof raw !== "object") return defaultBookmarks();
  const entries = Array.isArray(raw.bookmarks) ? raw.bookmarks : [];
  const bookmarks = entries
    .map((entry: any) => ({
      path: typeof entry?.path === "string" ? entry.path : "",
      name: typeof entry?.name === "string" ? entry.name : "",
      moduleType:
        entry?.moduleType === "cognitiveNotes" ? "cognitiveNotes" : "parallelmind",
      indexType:
        entry?.indexType === "cognitiveNotes"
          ? "cognitiveNotes"
          : entry?.indexType === "rootIndex"
            ? "rootIndex"
            : entry?.moduleType === "cognitiveNotes"
              ? "cognitiveNotes"
              : "rootIndex",
      views: typeof entry?.views === "number" ? entry.views : 0,
      lastOpened: typeof entry?.lastOpened === "string" ? entry.lastOpened : "",
    }))
    .filter((entry: BookmarkEntry) => entry.path || entry.name);
  return {
    schema_version: BOOKMARKS_SCHEMA_VERSION,
    bookmarks,
  };
};

export async function resolveAppDataLocation(args: {
  settings: AppSettings;
  handle: FileSystemDirectoryHandle | null;
}): Promise<{ dirPath?: string; dirHandle?: FileSystemDirectoryHandle } | null> {
  const isDesktopMode =
    typeof (window as any).__TAURI_INTERNALS__ !== "undefined";
  if (isDesktopMode) {
    const path = args.settings?.storage?.appDataFolderPath ?? null;
    return path ? { dirPath: path } : null;
  }
  const handle =
    args.handle ??
    (await loadAppDataDirectoryHandle().catch(() => null));
  return handle ? { dirHandle: handle } : null;
}

export async function loadBookmarksFromPath(dirPath: string): Promise<BookmarkFile> {
  const filePath = joinPath(dirPath, BOOKMARKS_FILE_NAME);
  const { exists, readTextFile, writeTextFile } = await import(
    "@tauri-apps/plugin-fs"
  );
  if (await exists(filePath)) {
    try {
      const text = await readTextFile(filePath);
      const parsed = JSON.parse(text);
      return normalizeBookmarks(parsed);
    } catch {
      const fallback = defaultBookmarks();
      await writeTextFile(filePath, JSON.stringify(fallback, null, 2), {
        create: true,
      });
      return fallback;
    }
  }
  const created = defaultBookmarks();
  await writeTextFile(filePath, JSON.stringify(created, null, 2), {
    create: true,
  });
  return created;
}

export async function saveBookmarksToPath(
  dirPath: string,
  data: BookmarkFile
): Promise<void> {
  const filePath = joinPath(dirPath, BOOKMARKS_FILE_NAME);
  const { writeTextFile } = await import("@tauri-apps/plugin-fs");
  await writeTextFile(filePath, JSON.stringify(data, null, 2), { create: true });
}

export async function loadBookmarksFromHandle(
  dirHandle: FileSystemDirectoryHandle
): Promise<BookmarkFile> {
  const fileHandle = await dirHandle.getFileHandle(BOOKMARKS_FILE_NAME, {
    create: true,
  });
  try {
    const file = await fileHandle.getFile();
    const text = await file.text();
    if (!text.trim()) return defaultBookmarks();
    return normalizeBookmarks(JSON.parse(text));
  } catch {
    return defaultBookmarks();
  }
}

export async function saveBookmarksToHandle(
  dirHandle: FileSystemDirectoryHandle,
  data: BookmarkFile
): Promise<void> {
  const fileHandle = await dirHandle.getFileHandle(BOOKMARKS_FILE_NAME, {
    create: true,
  });
  const writable = await (fileHandle as any).createWritable?.();
  if (!writable) return;
  try {
    await writable.write(JSON.stringify(data, null, 2));
    await writable.close();
  } catch {
    await writable.close().catch(() => {});
  }
}

export const addBookmarkEntry = (args: {
  data: BookmarkFile;
  entry: BookmarkEntry;
}): BookmarkFile => {
  const exists = args.data.bookmarks.some((item) => item.path === args.entry.path);
  if (exists) return args.data;
  return {
    ...args.data,
    bookmarks: [...args.data.bookmarks, args.entry],
  };
};

export const incrementBookmarkViews = (args: {
  data: BookmarkFile;
  path: string;
}): BookmarkFile | null => {
  const idx = args.data.bookmarks.findIndex((item) => item.path === args.path);
  if (idx === -1) return null;
  const next = [...args.data.bookmarks];
  const current = next[idx];
  next[idx] = {
    ...current,
    views: (current.views ?? 0) + 1,
    lastOpened: nowIso(),
  };
  return { ...args.data, bookmarks: next };
};

export const buildBookmarkEntry = (args: {
  path: string;
  name: string;
  moduleType: "parallelmind" | "cognitiveNotes";
}): BookmarkEntry => ({
  path: args.path,
  name: args.name,
  moduleType: args.moduleType,
  indexType: args.moduleType === "cognitiveNotes" ? "cognitiveNotes" : "rootIndex",
  views: 1,
  lastOpened: nowIso(),
});

const getIndexSuffix = (indexType: BookmarkIndexType): string =>
  indexType === "cognitiveNotes" ? COGNITIVE_NOTES_SUFFIX : PARALLELMIND_ROOT_SUFFIX;

const getDirPath = (filePath: string): string | null => {
  if (!filePath) return null;
  const trimmed = filePath.replace(/[\\/]+$/, "");
  const parts = trimmed.split(/[\\/]/);
  if (parts.length <= 1) return null;
  parts.pop();
  return parts.join(trimmed.includes("\\") ? "\\" : "/");
};

export const reconcileBookmarksOnStartup = async (args: {
  settings: AppSettings;
}): Promise<{ updated: boolean }> => {
  const isDesktopMode =
    typeof (window as any).__TAURI_INTERNALS__ !== "undefined";
  if (!isDesktopMode) return { updated: false };
  const dirPath = args.settings?.storage?.appDataFolderPath ?? null;
  if (!dirPath) return { updated: false };

  const { exists, readDir } = await import("@tauri-apps/plugin-fs");
  const data = await loadBookmarksFromPath(dirPath);
  let changed = false;
  const next: BookmarkEntry[] = [];

  for (const entry of data.bookmarks) {
    const indexType: BookmarkIndexType =
      entry.indexType ??
      (entry.moduleType === "cognitiveNotes" ? "cognitiveNotes" : "rootIndex");
    const suffix = getIndexSuffix(indexType);
    const entryPath = entry.path;

    if (entryPath && (await exists(entryPath))) {
      next.push(entry);
      continue;
    }

    const parentDir = getDirPath(entryPath);
    if (!parentDir || !(await exists(parentDir))) {
      const remove = window.confirm(
        `Bookmark path doesn't exist:\n${entryPath}\nDo you want to remove it?`
      );
      changed = true;
      if (!remove) next.push(entry);
      continue;
    }

    let replacementFile: string | null = null;
    try {
      const entries = await readDir(parentDir);
      const candidates = entries
        .filter((item: any) => item?.isFile && typeof item.name === "string")
        .map((item: any) => item.name)
        .filter((name: string) => name.endsWith(suffix))
        .sort((a: string, b: string) => a.localeCompare(b));
      replacementFile = candidates[0] ?? null;
    } catch {
      replacementFile = null;
    }

    if (!replacementFile) {
      const remove = window.confirm(
        `Bookmark path doesn't exist:\n${entryPath}\nDo you want to remove it?`
      );
      changed = true;
      if (!remove) next.push(entry);
      continue;
    }

    const nextPath = joinPath(parentDir, replacementFile);
    const nextName = replacementFile.replace(suffix, "");
    next.push({
      ...entry,
      path: nextPath,
      name: nextName || entry.name,
      indexType,
      moduleType: indexType === "cognitiveNotes" ? "cognitiveNotes" : "parallelmind",
    });
    changed = true;
  }

  if (changed) {
    await saveBookmarksToPath(dirPath, {
      ...data,
      bookmarks: next,
    });
  }
  return { updated: changed };
};

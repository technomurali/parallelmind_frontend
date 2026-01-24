import { loadAppDataDirectoryHandle } from "./appDataHandleStore";
import type { AppSettings } from "../store/mindMapStore";

export const BOOKMARKS_FILE_NAME = "parallelmind.json" as const;
export const BOOKMARKS_SCHEMA_VERSION = "1.0.0" as const;
export const PARALLELMIND_ROOT_SUFFIX = "_rootIndex.json" as const;
export const COGNITIVE_NOTES_SUFFIX = "_cognitiveNotes.json" as const;

export type BookmarkEntry = {
  path: string;
  name: string;
  moduleType: "parallelmind" | "cognitiveNotes";
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
  views: 1,
  lastOpened: nowIso(),
});

/**
 * fileManager.ts
 * 
 * Logic for create, read, update, delete (CRUD) operations on files and folders.
 * Handles all file system operations including:
 * - Creating new files and folders
 * - Reading file contents and folder structures
 * - Updating file contents and metadata
 * - Deleting files and folders
 * - Synchronizing changes with the parallelmind_index.json structure
 */

export interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  content?: string;
}

export type FolderTypeByLevel = "folder_A" | "folder_B" | "folder_C" | "folder_D";
export type FileTypeByLevel = "file_A" | "file_B" | "file_C" | "file_D";

export type IndexFolderNode = {
  id: string;
  name: string;
  purpose: string;
  type: FolderTypeByLevel;
  level: 1 | 2 | 3 | 4;
  path: string; // absolute (desktop) or relative-from-root (web)
  created_on: string;
  updated_on: string;
  last_viewed_on: string;
  views: number;
  child: IndexNode[];
};

export type IndexFileNode = {
  id: string;
  name: string; // filename without extension
  extension: string; // e.g. "txt", "pdf"; empty string if no extension
  purpose: string;
  type: FileTypeByLevel;
  level: 1 | 2 | 3 | 4;
  path: string; // absolute (desktop) or relative-from-root (web)
  created_on: string;
  updated_on: string;
  last_viewed_on: string;
  views: number;
};

export type IndexNode = IndexFolderNode | IndexFileNode;

export type RootFolderJson = {
  schema_version: "1.0.0";
  id: string; // UUID
  name: string; // folder name of ROOT_PATH
  purpose: string; // user provides later
  type: "root_folder";
  level: 0;
  path: string; // absolute path in desktop mode; empty string in browser mode
  created_on: string; // ISO UTC timestamp
  updated_on: string; // ISO UTC timestamp
  last_viewed_on: string; // ISO UTC timestamp
  views: number;
  notifications: string[];
  recommendations: string[];
  error_messages: string[];
  child: IndexNode[];
};

/**
 * FileManager class
 * 
 * Manages all CRUD operations for files and folders in the mind map.
 * Provides methods to interact with the file system structure and
 * maintain consistency with parallelmind_index.json.
 */
export class FileManager {
  private static ROOT_FILE_NAME = 'parallelmind_index.json' as const;
  private static MAX_LEVEL = 4 as const;

  private nowIso(): string {
    return new Date().toISOString();
  }

  private generateUuid(): string {
    // Browser + Tauri frontend should support crypto.randomUUID in modern runtimes.
    // Fallback kept lightweight.
    const c = (globalThis as any)?.crypto;
    if (c?.randomUUID) return c.randomUUID();
    // Fallback: not a true UUIDv4, but unique enough for local ids if crypto.randomUUID is unavailable.
    return `pm_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  private isTauri(): boolean {
    return typeof (window as any).__TAURI_INTERNALS__ !== 'undefined';
  }

  private joinPath(dirPath: string, fileName: string): string {
    const trimmed = dirPath.replace(/[\\/]+$/, '');
    const sep = trimmed.includes('\\') ? '\\' : '/';
    return `${trimmed}${sep}${fileName}`;
  }

  private baseNameFromPath(dirPath: string): string {
    const trimmed = dirPath.replace(/[\\/]+$/, '');
    const parts = trimmed.split(/[\\/]/);
    return parts[parts.length - 1] || trimmed;
  }

  private folderTypeForLevel(level: number): FolderTypeByLevel {
    if (level === 1) return "folder_A";
    if (level === 2) return "folder_B";
    if (level === 3) return "folder_C";
    return "folder_D";
  }

  private fileTypeForLevel(level: number): FileTypeByLevel {
    if (level === 1) return "file_A";
    if (level === 2) return "file_B";
    if (level === 3) return "file_C";
    return "file_D";
  }

  private splitFileName(fileName: string): { name: string; extension: string } {
    const trimmed = (fileName ?? "").trim();
    const lastDot = trimmed.lastIndexOf(".");
    if (lastDot <= 0 || lastDot === trimmed.length - 1) {
      return { name: trimmed, extension: "" };
    }
    return {
      name: trimmed.slice(0, lastDot),
      extension: trimmed.slice(lastDot + 1),
    };
  }

  private joinRel(parent: string, childName: string): string {
    const p = (parent ?? "").replace(/\/+$/, "");
    const c = (childName ?? "").replace(/^\/+/, "");
    return p ? `${p}/${c}` : c;
  }

  /**
   * Validates parsed JSON as the strict v1.0.0 root folder index schema.
   * Returns null when the schema is missing/invalid (treated as "no index").
   *
   * Note: We intentionally do NOT support old schemas anymore.
   */
  private parseRootFolderJsonV1(input: unknown): RootFolderJson | null {
    const obj = (input ?? {}) as any;
    if (!obj || typeof obj !== "object") return null;
    if (obj.schema_version !== "1.0.0") return null;
    if (obj.type !== "root_folder") return null;
    if (obj.level !== 0) return null;

    const requiredString = (v: unknown) => typeof v === "string" && v.trim().length > 0;
    if (!requiredString(obj.id)) return null;
    if (!requiredString(obj.name)) return null;

    // purpose can be empty (user gives later)
    const purpose = typeof obj.purpose === "string" ? obj.purpose : "";

    const path = typeof obj.path === "string" ? obj.path : "";

    const created_on = typeof obj.created_on === "string" ? obj.created_on : "";
    const updated_on = typeof obj.updated_on === "string" ? obj.updated_on : created_on;
    const last_viewed_on =
      typeof obj.last_viewed_on === "string" ? obj.last_viewed_on : created_on;

    const views = typeof obj.views === "number" && Number.isFinite(obj.views) ? obj.views : 0;

    const notifications = Array.isArray(obj.notifications)
      ? obj.notifications.filter((x: any) => typeof x === "string")
      : [];
    const recommendations = Array.isArray(obj.recommendations)
      ? obj.recommendations.filter((x: any) => typeof x === "string")
      : [];
    const error_messages = Array.isArray(obj.error_messages)
      ? obj.error_messages.filter((x: any) => typeof x === "string")
      : [];

    const child = Array.isArray(obj.child) ? (obj.child as IndexNode[]) : [];

    return {
      schema_version: "1.0.0",
      id: obj.id,
      name: obj.name,
      purpose,
      type: "root_folder",
      level: 0,
      path,
      created_on,
      updated_on,
      last_viewed_on,
      views,
      notifications,
      recommendations,
      error_messages,
      child,
    };
  }

  private buildNewRootFolderJson(args: {
    name: string;
    path: string;
    now?: string;
  }): RootFolderJson {
    const now = args.now ?? this.nowIso();
    return {
      schema_version: "1.0.0",
      id: this.generateUuid(),
      name: args.name,
      purpose: "",
      type: "root_folder",
      level: 0,
      path: args.path,
      created_on: now,
      updated_on: now,
      last_viewed_on: now,
      views: 0,
      notifications: [],
      recommendations: [],
      error_messages: [],
      child: [],
    };
  }

  /**
   * Initialize (rebuild) the ParallelMind index by scanning the selected folder.
   * This always constructs from scratch and only writes to disk at the end.
   */
  async initializeIndexFromHandle(
    dirHandle: FileSystemDirectoryHandle,
  ): Promise<RootFolderJson> {
    const now = this.nowIso();
    // Web mode: root path is not available; use empty string.
    const root = this.buildNewRootFolderJson({ name: dirHandle.name, path: "", now });

    // Root notification: if any non-index FILE exists at root before initialization.
    for await (const entry of dirHandle.values()) {
      if (entry.kind === "file" && entry.name !== FileManager.ROOT_FILE_NAME) {
        root.notifications.push("Root folder contained files before initialization");
        break;
      }
    }

    // Build children (level 1).
    root.child = await this.scanDirectoryHandle(
      dirHandle,
      1,
      "",
      root.notifications,
      now,
    );

    // Persist once at the end.
    await this.writeRootFolderJson(dirHandle, root);
    return root;
  }

  async initializeIndexFromPath(rootPath: string): Promise<RootFolderJson> {
    const now = this.nowIso();
    const rootName = this.baseNameFromPath(rootPath);
    const root = this.buildNewRootFolderJson({ name: rootName, path: rootPath, now });

    try {
      const { readDir } = await import("@tauri-apps/plugin-fs");
      const entries = await readDir(rootPath);
      if (entries.some((e: any) => e?.isFile && e?.name !== FileManager.ROOT_FILE_NAME)) {
        root.notifications.push("Root folder contained files before initialization");
      }
      root.child = await this.scanDirPath(rootPath, 1, rootPath, root.notifications, now);
    } catch (err) {
      // If scanning fails, do not write partial results. Surface as root error message.
      root.error_messages.push(`Failed to scan root folder: ${String(err)}`);
      root.child = [];
    }

    await this.writeRootFolderJsonFromPathAtomic(rootPath, root);
    return root;
  }

  private async scanDirectoryHandle(
    dirHandle: FileSystemDirectoryHandle,
    level: number,
    parentRel: string,
    rootNotifications: string[],
    now: string,
  ): Promise<IndexNode[]> {
    // If the branch is beyond max depth, do not create nodes.
    if (level > FileManager.MAX_LEVEL) return [];

    const nodes: IndexNode[] = [];

    // Prefer stable order: folders first, then files (by name).
    const dirs: FileSystemDirectoryHandle[] = [];
    const files: FileSystemFileHandle[] = [];
    for await (const entry of dirHandle.values()) {
      if (level === 1 && entry.name === FileManager.ROOT_FILE_NAME) continue;
      if (entry.kind === "directory") dirs.push(entry);
      else if (entry.kind === "file") files.push(entry);
    }
    dirs.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    files.sort((a, b) => String(a.name).localeCompare(String(b.name)));

    for (const d of dirs) {
      const relPath = this.joinRel(parentRel, d.name);
      const folderNode: IndexFolderNode = {
        id: this.generateUuid(),
        name: d.name,
        purpose: "",
        type: this.folderTypeForLevel(level),
        level: level as 1 | 2 | 3 | 4,
        path: relPath,
        created_on: now,
        updated_on: now,
        last_viewed_on: now,
        views: 0,
        child: [],
      };
      if (level < FileManager.MAX_LEVEL) {
        folderNode.child = await this.scanDirectoryHandle(
          d,
          level + 1,
          relPath,
          rootNotifications,
          now,
        );
      } else {
        // folder_D: do not descend into subfolders, but files are allowed.
        folderNode.child = await this.scanDirectoryHandleFilesOnlyAtMaxLevel(
          d,
          relPath,
          rootNotifications,
          now,
        );
      }
      nodes.push(folderNode);
    }

    for (const f of files) {
      const relPath = this.joinRel(parentRel, f.name);
      const parts = this.splitFileName(f.name);
      const fileNode: IndexFileNode = {
        id: this.generateUuid(),
        name: parts.name,
        extension: parts.extension,
        purpose: "",
        type: this.fileTypeForLevel(level),
        level: level as 1 | 2 | 3 | 4,
        path: relPath,
        created_on: now,
        updated_on: now,
        last_viewed_on: now,
        views: 0,
      };
      nodes.push(fileNode);
    }

    return nodes;
  }

  private async scanDirectoryHandleFilesOnlyAtMaxLevel(
    dirHandle: FileSystemDirectoryHandle,
    parentRel: string,
    rootNotifications: string[],
    now: string,
  ): Promise<IndexNode[]> {
    const files: FileSystemFileHandle[] = [];
    for await (const entry of dirHandle.values()) {
      if (entry.kind === "directory") {
        const relPath = this.joinRel(parentRel, entry.name);
        rootNotifications.push(`Maximum folder depth exceeded at ${relPath}`);
        continue;
      }
      if (entry.kind === "file") files.push(entry);
    }
    files.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    return files.map((f) => {
      const relPath = this.joinRel(parentRel, f.name);
      const parts = this.splitFileName(f.name);
      const fileNode: IndexFileNode = {
        id: this.generateUuid(),
        name: parts.name,
        extension: parts.extension,
        purpose: "",
        type: this.fileTypeForLevel(FileManager.MAX_LEVEL),
        level: FileManager.MAX_LEVEL,
        path: relPath,
        created_on: now,
        updated_on: now,
        last_viewed_on: now,
        views: 0,
      };
      return fileNode;
    });
  }

  private async scanDirPath(
    dirPath: string,
    level: number,
    parentPath: string,
    rootNotifications: string[],
    now: string,
  ): Promise<IndexNode[]> {
    if (level > FileManager.MAX_LEVEL) return [];

    const nodes: IndexNode[] = [];
    const { readDir } = await import("@tauri-apps/plugin-fs");

    const entries = await readDir(dirPath);
    const dirs = entries.filter((e: any) => e?.isDirectory && !e?.isSymlink);
    const files = entries.filter((e: any) => e?.isFile && !e?.isSymlink);

    dirs.sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)));
    files.sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)));

    for (const d of dirs) {
      const absPath = this.joinPath(parentPath, d.name);

      const folderNode: IndexFolderNode = {
        id: this.generateUuid(),
        name: d.name,
        purpose: "",
        type: this.folderTypeForLevel(level),
        level: level as 1 | 2 | 3 | 4,
        path: absPath,
        created_on: now,
        updated_on: now,
        last_viewed_on: now,
        views: 0,
        child: [],
      };
      if (level < FileManager.MAX_LEVEL) {
        folderNode.child = await this.scanDirPath(
          absPath,
          level + 1,
          absPath,
          rootNotifications,
          now,
        );
      } else {
        folderNode.child = await this.scanDirPathFilesOnlyAtMaxLevel(
          absPath,
          absPath,
          rootNotifications,
          now,
        );
      }
      nodes.push(folderNode);
    }

    for (const f of files) {
      if (level === 1 && f.name === FileManager.ROOT_FILE_NAME) continue;
      const absPath = this.joinPath(parentPath, f.name);
      const parts = this.splitFileName(f.name);
      const fileNode: IndexFileNode = {
        id: this.generateUuid(),
        name: parts.name,
        extension: parts.extension,
        purpose: "",
        type: this.fileTypeForLevel(level),
        level: level as 1 | 2 | 3 | 4,
        path: absPath,
        created_on: now,
        updated_on: now,
        last_viewed_on: now,
        views: 0,
      };
      nodes.push(fileNode);
    }

    return nodes;
  }

  private async scanDirPathFilesOnlyAtMaxLevel(
    dirPath: string,
    parentPath: string,
    rootNotifications: string[],
    now: string,
  ): Promise<IndexNode[]> {
    const { readDir } = await import("@tauri-apps/plugin-fs");
    const entries = await readDir(dirPath);
    const nodes: IndexNode[] = [];

    // Any subfolder at level 4 -> notification, skip it.
    for (const e of entries as any[]) {
      if (e?.isSymlink) continue;
      if (e?.isDirectory) {
        const absPath = this.joinPath(parentPath, e.name);
        rootNotifications.push(`Maximum folder depth exceeded at ${absPath}`);
      }
    }

    const files = (entries as any[]).filter((e) => e?.isFile && !e?.isSymlink);
    files.sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)));
    for (const f of files) {
      const absPath = this.joinPath(parentPath, f.name);
      const parts = this.splitFileName(f.name);
      const fileNode: IndexFileNode = {
        id: this.generateUuid(),
        name: parts.name,
        extension: parts.extension,
        purpose: "",
        type: this.fileTypeForLevel(FileManager.MAX_LEVEL),
        level: FileManager.MAX_LEVEL,
        path: absPath,
        created_on: now,
        updated_on: now,
        last_viewed_on: now,
        views: 0,
      };
      nodes.push(fileNode);
    }
    return nodes;
  }

  private async writeRootFolderJsonFromPathAtomic(
    dirPath: string,
    root: RootFolderJson,
  ): Promise<void> {
    const { writeTextFile, rename, remove } = await import("@tauri-apps/plugin-fs");
    const finalPath = this.joinPath(dirPath, FileManager.ROOT_FILE_NAME);
    const tmpPath = this.joinPath(dirPath, `${FileManager.ROOT_FILE_NAME}.tmp`);
    const payload = JSON.stringify(root, null, 2);
    await writeTextFile(tmpPath, payload, { create: true });
    try {
      await rename(tmpPath, finalPath);
    } catch {
      // Fallback: write directly, then best-effort cleanup.
      await writeTextFile(finalPath, payload, { create: true });
      try {
        await remove(tmpPath);
      } catch {
        // ignore
      }
    }
  }

  /**
   * Reads parallelmind_index.json from the selected directory if it exists.
   * Returns null when the file does not exist or cannot be read.
   *
   * We keep failures silent by design (no alerts/toasts).
   */
  async readRootFolderJson(dirHandle: FileSystemDirectoryHandle): Promise<RootFolderJson | null> {
    try {
      const fileHandle = await dirHandle.getFileHandle(FileManager.ROOT_FILE_NAME, {
        create: false,
      });
      const file = await fileHandle.getFile();
      const text = await file.text();
      const parsed = JSON.parse(text);
      return this.parseRootFolderJsonV1(parsed);
    } catch (err) {
      // Missing file is expected for first-time roots.
      if (err instanceof DOMException && err.name === 'NotFoundError') return null;
      // Parse errors or permission issues: do not overwrite the file, just treat as unreadable.
      return null;
    }
  }

  /**
   * Loads existing parallelmind_index.json if present; otherwise creates it.
   * This prevents "recreating" the root when the file already exists.
   */
  async loadOrCreateRootFolderJson(
    dirHandle: FileSystemDirectoryHandle,
  ): Promise<{ root: RootFolderJson; created: boolean }> {
    const existing = await this.readRootFolderJson(dirHandle);
    if (existing) return { root: existing, created: false };

    const createdRoot = await this.createRootFolderJson(dirHandle);
    return { root: createdRoot, created: true };
  }

  /**
   * Opens the Windows directory picker (File System Access API).
   * Returns null if the user cancels.
   */
  async pickRootDirectory(): Promise<FileSystemDirectoryHandle | string | null> {
    // In Tauri desktop we prefer the native dialog because it returns an absolute path.
    // The dialog plugin also scopes the selected directory for fs access.
    if (this.isTauri()) {
      try {
        const { open } = await import('@tauri-apps/plugin-dialog');
        const selected = await open({ directory: true, multiple: false });
        return typeof selected === 'string' ? selected : null;
      } catch {
        return null; // silent by UX rules
      }
    }

    const showDirectoryPicker = (window as any).showDirectoryPicker as
      | (() => Promise<FileSystemDirectoryHandle>)
      | undefined;
    if (!showDirectoryPicker) return null;

    try {
      return await showDirectoryPicker();
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return null;
      return null; // silent by UX rules
    }
  }

  /**
   * Reads parallelmind_index.json from an absolute directory path (Tauri).
   * Returns null when missing/unreadable. Silent by design.
   */
  async readRootFolderJsonFromPath(dirPath: string): Promise<RootFolderJson | null> {
    try {
      const { exists, readTextFile } = await import('@tauri-apps/plugin-fs');
      const filePath = this.joinPath(dirPath, FileManager.ROOT_FILE_NAME);
      if (!(await exists(filePath))) return null;
      const text = await readTextFile(filePath);
      const parsed = JSON.parse(text);
      return this.parseRootFolderJsonV1(parsed);
    } catch {
      return null;
    }
  }

  async writeRootFolderJsonFromPath(dirPath: string, root: RootFolderJson): Promise<void> {
    if (!dirPath || typeof dirPath !== 'string' || dirPath.trim() === '') {
      console.error('[FileManager] writeRootFolderJsonFromPath: dirPath is empty or invalid', dirPath);
      throw new Error('Directory path is required for saving parallelmind_index.json');
    }

    try {
      // Enforce strict v1.0.0 schema on write.
      const now = this.nowIso();
      const existing = await this.readRootFolderJsonFromPath(dirPath);
      const created_on =
        (root.created_on && typeof root.created_on === "string" && root.created_on) ||
        existing?.created_on ||
        now;
      const last_viewed_on =
        (root.last_viewed_on && typeof root.last_viewed_on === "string" && root.last_viewed_on) ||
        existing?.last_viewed_on ||
        created_on;

      const normalized: RootFolderJson = {
        schema_version: "1.0.0",
        id:
          (typeof root.id === "string" && root.id) ||
          existing?.id ||
          this.generateUuid(),
        name:
          (typeof root.name === "string" && root.name) ||
          existing?.name ||
          this.baseNameFromPath(dirPath),
        purpose: typeof root.purpose === "string" ? root.purpose : existing?.purpose ?? "",
        type: "root_folder",
        level: 0,
        path: dirPath,
        created_on,
        updated_on:
          (typeof root.updated_on === "string" && root.updated_on) ||
          existing?.updated_on ||
          now,
        last_viewed_on,
        views:
          typeof root.views === "number" && Number.isFinite(root.views)
            ? root.views
            : existing?.views ?? 0,
        notifications: Array.isArray(root.notifications)
          ? root.notifications
          : existing?.notifications ?? [],
        recommendations: Array.isArray(root.recommendations)
          ? root.recommendations
          : existing?.recommendations ?? [],
        error_messages: Array.isArray(root.error_messages)
          ? root.error_messages
          : existing?.error_messages ?? [],
        child: Array.isArray(root.child) ? (root.child as IndexNode[]) : existing?.child ?? [],
      };

      await this.writeRootFolderJsonFromPathAtomic(dirPath, normalized);
    } catch (error) {
      console.error('[FileManager] Failed to write parallelmind_index.json:', error);
      throw error;
    }
  }

  async loadOrCreateRootFolderJsonFromPath(
    dirPath: string,
  ): Promise<{ root: RootFolderJson; created: boolean }> {
    if (!dirPath || typeof dirPath !== 'string' || dirPath.trim() === '') {
      throw new Error('Directory path is required for loading parallelmind_index.json');
    }

    const existing = await this.readRootFolderJsonFromPath(dirPath);
    if (existing) {
      // Ensure path is set (desktop mode should always have absolute path).
      return { root: { ...existing, path: dirPath }, created: false };
    }

    const createdRoot = this.buildNewRootFolderJson({
      name: this.baseNameFromPath(dirPath),
      path: dirPath,
    });
    await this.writeRootFolderJsonFromPath(dirPath, createdRoot);
    return { root: createdRoot, created: true };
  }

  /**
   * Creates (or overwrites) `parallelmind_index.json` in the selected folder with the strict initial structure.
   * This JSON file is the single source of truth (no extra keys).
   */
  async createRootFolderJson(
    dirHandle: FileSystemDirectoryHandle,
  ): Promise<RootFolderJson> {
    // Browser mode: we cannot reliably know an absolute path. Per spec, store "".
    const root = this.buildNewRootFolderJson({
      name: dirHandle.name,
      path: "",
    });
    await this.writeRootFolderJson(dirHandle, root);
    return root;
  }

  async writeRootFolderJson(
    dirHandle: FileSystemDirectoryHandle,
    root: RootFolderJson,
  ): Promise<void> {
    const now = this.nowIso();
      const existing = await this.readRootFolderJson(dirHandle);

    const created_on =
      (root.created_on && typeof root.created_on === "string" && root.created_on) ||
      existing?.created_on ||
      now;
    const last_viewed_on =
      (root.last_viewed_on && typeof root.last_viewed_on === "string" && root.last_viewed_on) ||
      existing?.last_viewed_on ||
      created_on;

    const normalized: RootFolderJson = {
      schema_version: "1.0.0",
      id:
        (typeof root.id === "string" && root.id) ||
        existing?.id ||
        this.generateUuid(),
      name:
        (typeof root.name === "string" && root.name) ||
        existing?.name ||
        dirHandle.name,
      purpose: typeof root.purpose === "string" ? root.purpose : existing?.purpose ?? "",
      type: "root_folder",
      level: 0,
      // Browser mode: keep empty string. (Do not attempt to infer absolute path.)
      path: "",
      created_on,
      updated_on:
        (typeof root.updated_on === "string" && root.updated_on) ||
        existing?.updated_on ||
        now,
      last_viewed_on,
      views:
        typeof root.views === "number" && Number.isFinite(root.views)
          ? root.views
          : existing?.views ?? 0,
      notifications: Array.isArray(root.notifications)
        ? root.notifications
        : existing?.notifications ?? [],
      recommendations: Array.isArray(root.recommendations)
        ? root.recommendations
        : existing?.recommendations ?? [],
      error_messages: Array.isArray(root.error_messages)
        ? root.error_messages
        : existing?.error_messages ?? [],
      child: Array.isArray(root.child) ? (root.child as IndexNode[]) : existing?.child ?? [],
    };

    const fileHandle = await dirHandle.getFileHandle(FileManager.ROOT_FILE_NAME, {
      create: true,
    });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(normalized, null, 2));
    await writable.close();
  }

  /**
   * Creates a new file or folder in the specified location
   * @param parentId - ID of the parent folder
   * @param node - FileNode to create
   */
  create(_parentId: string, _node: FileNode): void {
    // TODO: Implement file/folder creation
  }

  /**
   * Reads a file or folder by ID
   * @param id - ID of the node to read
   * @returns FileNode or null if not found
   */
  read(_id: string): FileNode | null {
    // TODO: Implement file/folder reading
    return null;
  }

  /**
   * Updates an existing file or folder
   * @param id - ID of the node to update
   * @param updates - Partial FileNode with updates
   */
  update(_id: string, _updates: Partial<FileNode>): void {
    // TODO: Implement file/folder updates
  }

  /**
   * Deletes a file or folder
   * @param id - ID of the node to delete
   */
  delete(_id: string): void {
    // TODO: Implement file/folder deletion
  }

  /**
   * Synchronizes the current state with parallelmind_index.json
   * Ensures all changes are persisted to the master structure file
   */
  sync(): void {
    // TODO: Implement sync logic
  }
}
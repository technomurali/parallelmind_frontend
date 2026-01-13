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

export type RootFolderJson = {
  id: number; // root must be 0 (number type) when written
  node_id: '00'; // root node id (string)
  level_id: number; // root must be 0 (number type) when written
  node_type: 'root_folder';
  created_date: string; // ISO timestamp
  update_date: string; // ISO timestamp
  path: string; // absolute path when available from runtime; otherwise preserved if already present
  name: string;
  purpose: string;
  children: unknown[];
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

  private nowIso(): string {
    return new Date().toISOString();
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

  /**
   * Normalizes any parsed JSON into the strict root folder index schema.
   * Important: this does NOT write to disk; it only shapes data in-memory.
   */
  private normalizeRootFolderJson(input: unknown, fallbackFolderName: string): RootFolderJson {
    const obj = (input ?? {}) as any;
    const children = Array.isArray(obj.children) ? obj.children : [];
    const created = typeof obj.created_date === 'string' ? obj.created_date : this.nowIso();
    const updated = typeof obj.update_date === 'string' ? obj.update_date : created;
    const path = typeof obj.path === 'string' ? obj.path : '';
    return {
      id: 0,
      node_id: '00',
      level_id: 0,
      node_type: 'root_folder',
      created_date: created,
      update_date: updated,
      path,
      name: typeof obj.name === 'string' ? obj.name : fallbackFolderName,
      purpose: typeof obj.purpose === 'string' ? obj.purpose : (typeof obj.description === 'string' ? obj.description : ''),
      children,
    };
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
      return this.normalizeRootFolderJson(parsed, dirHandle.name);
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
      return this.normalizeRootFolderJson(parsed, this.baseNameFromPath(dirPath));
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
      const now = this.nowIso();
      const existing = await this.readRootFolderJsonFromPath(dirPath);
      const createdDate = root.created_date || existing?.created_date || now;

      const normalized: RootFolderJson = {
        id: 0,
        node_id: '00',
        level_id: 0,
        node_type: 'root_folder',
        created_date: createdDate,
        update_date: now,
        path: dirPath,
        name: root.name ?? this.baseNameFromPath(dirPath),
        purpose: root.purpose ?? '',
        children: Array.isArray(root.children) ? root.children : existing?.children ?? [],
      };

      const { writeTextFile } = await import('@tauri-apps/plugin-fs');
      const filePath = this.joinPath(dirPath, FileManager.ROOT_FILE_NAME);
      console.log('[FileManager] Writing parallelmind_index.json to:', filePath);
      await writeTextFile(filePath, JSON.stringify(normalized, null, 2), { create: true });
      console.log('[FileManager] Successfully wrote parallelmind_index.json');
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
      // Always ensure path is set, even if it wasn't in the file
      const rootWithPath = { ...existing, path: dirPath };
      console.log('[FileManager] Loaded existing parallelmind_index.json from:', dirPath);
      return { root: rootWithPath, created: false };
    }

    const now = this.nowIso();
    const createdRoot: RootFolderJson = {
      id: 0,
      node_id: '00',
      level_id: 0,
      node_type: 'root_folder',
      created_date: now,
      update_date: now,
      path: dirPath,
      name: this.baseNameFromPath(dirPath),
      purpose: '',
      children: [],
    };
    console.log('[FileManager] Creating new parallelmind_index.json at:', dirPath);
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
    const now = this.nowIso();
    // Note: Standard browsers do not expose absolute OS paths for security reasons.
    // Some desktop runtimes/wrappers may add a non-standard `path` field to the handle.
    const path =
      typeof (dirHandle as any)?.path === 'string'
        ? (dirHandle as any).path
        : typeof (dirHandle as any)?.fullPath === 'string'
          ? (dirHandle as any).fullPath
          : '';
    const root: RootFolderJson = {
      id: 0,
      node_id: '00',
      level_id: 0,
      node_type: 'root_folder',
      created_date: now,
      update_date: now,
      path,
      name: dirHandle.name,
      purpose: '',
      children: [],
    };
    await this.writeRootFolderJson(dirHandle, root);
    return root;
  }

  async writeRootFolderJson(
    dirHandle: FileSystemDirectoryHandle,
    root: RootFolderJson,
  ): Promise<void> {
    const now = this.nowIso();

    // Normalize to the strict schema (no extra keys; correct id/node_id/level_id types).
    // NOTE: children are preserved to avoid wiping existing tree data.
    // created_date is preserved when possible; update_date is always refreshed on write.
    let createdDate = root.created_date;
    if (typeof createdDate !== 'string' || !createdDate) {
      const existing = await this.readRootFolderJson(dirHandle);
      createdDate = existing?.created_date ?? now;
    }

    // Preserve path when not provided (avoid clobbering a previously known absolute path).
    let path = root.path;
    if (typeof path !== 'string' || !path) {
      const existing = await this.readRootFolderJson(dirHandle);
      path = existing?.path ?? '';
    }

    const normalized: RootFolderJson = {
      id: 0,
      node_id: '00',
      level_id: 0,
      node_type: 'root_folder',
      created_date: createdDate,
      update_date: now,
      path,
      name: root.name ?? '',
      purpose: root.purpose ?? '',
      children: Array.isArray(root.children) ? root.children : [],
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
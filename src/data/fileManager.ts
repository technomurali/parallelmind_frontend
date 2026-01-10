/**
 * fileManager.ts
 * 
 * Logic for create, read, update, delete (CRUD) operations on files and folders.
 * Handles all file system operations including:
 * - Creating new files and folders
 * - Reading file contents and folder structures
 * - Updating file contents and metadata
 * - Deleting files and folders
 * - Synchronizing changes with the root-folder.json structure
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
  name: string;
  title: string;
  description: string;
  children: unknown[];
};

/**
 * FileManager class
 * 
 * Manages all CRUD operations for files and folders in the mind map.
 * Provides methods to interact with the file system structure and
 * maintain consistency with root-folder.json.
 */
export class FileManager {
  private static ROOT_FILE_NAME = 'root-folder.json' as const;

  /**
   * Normalizes any parsed JSON into the strict root-folder schema.
   * Important: this does NOT write to disk; it only shapes data in-memory.
   */
  private normalizeRootFolderJson(input: unknown, fallbackFolderName: string): RootFolderJson {
    const obj = (input ?? {}) as any;
    const children = Array.isArray(obj.children) ? obj.children : [];
    return {
      id: 0,
      node_id: '00',
      level_id: 0,
      name: typeof obj.name === 'string' ? obj.name : fallbackFolderName,
      title: typeof obj.title === 'string' ? obj.title : '',
      description: typeof obj.description === 'string' ? obj.description : '',
      children,
    };
  }

  /**
   * Reads root-folder.json from the selected directory if it exists.
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
   * Loads existing root-folder.json if present; otherwise creates it.
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
  async pickRootDirectory(): Promise<FileSystemDirectoryHandle | null> {
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
   * Creates (or overwrites) `root-folder.json` in the selected folder with the strict initial structure.
   * This JSON file is the single source of truth (no extra keys).
   */
  async createRootFolderJson(
    dirHandle: FileSystemDirectoryHandle,
  ): Promise<RootFolderJson> {
    const root: RootFolderJson = {
      id: 0,
      node_id: '00',
      level_id: 0,
      name: dirHandle.name,
      title: '',
      description: '',
      children: [],
    };
    await this.writeRootFolderJson(dirHandle, root);
    return root;
  }

  async writeRootFolderJson(
    dirHandle: FileSystemDirectoryHandle,
    root: RootFolderJson,
  ): Promise<void> {
    // Normalize to the strict schema (no extra keys; correct id/node_id/level_id types).
    // NOTE: children are preserved to avoid wiping existing tree data.
    const normalized: RootFolderJson = {
      id: 0,
      node_id: '00',
      level_id: 0,
      name: root.name ?? '',
      title: root.title ?? '',
      description: root.description ?? '',
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
   * Synchronizes the current state with root-folder.json
   * Ensures all changes are persisted to the master structure file
   */
  sync(): void {
    // TODO: Implement sync logic
  }
}
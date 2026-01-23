/**
 * fileManager.ts
 * 
 * Logic for create, read, update, delete (CRUD) operations on files and folders.
 * Handles all file system operations including:
 * - Creating new files and folders
 * - Reading file contents and folder structures
 * - Updating file contents and metadata
 * - Deleting files and folders
 * - Synchronizing changes with the root index json structure
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

export type FlowchartNode = {
  id: string;
  type: string;
  name: string;
  purpose: string;
  created_on: string;
  updated_on: string;
};

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
  node_positions: Record<string, { x: number; y: number }>;
  node_size: Record<string, number>;
  flowchart_nodes: FlowchartNode[];
  child: IndexNode[];
};

/**
 * FileManager class
 * 
 * Manages all CRUD operations for files and folders in the mind map.
 * Provides methods to interact with the file system structure and
 * maintain consistency with the root index json.
 */
export class FileManager {
  private static LEGACY_ROOT_FILE_NAME = "parallelmind_index.json" as const;
  private static ROOT_FILE_SUFFIX = "_rootIndex.json" as const;
  private static LEGACY_ROOT_SUFFIX = "_index.json" as const;
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

  private getIndexFileName(rootName: string): string {
    const trimmed = (rootName ?? "").trim();
    if (!trimmed) return FileManager.LEGACY_ROOT_FILE_NAME;
    return `${trimmed}${FileManager.ROOT_FILE_SUFFIX}`;
  }

  private getLegacyIndexFileName(rootName: string): string {
    const trimmed = (rootName ?? "").trim();
    if (!trimmed) return FileManager.LEGACY_ROOT_FILE_NAME;
    return `${trimmed}${FileManager.LEGACY_ROOT_SUFFIX}`;
  }

  private getIndexFileNameFromHandle(dirHandle: FileSystemDirectoryHandle): string {
    return this.getIndexFileName(dirHandle?.name ?? "");
  }

  private getLegacyIndexFileNameFromHandle(dirHandle: FileSystemDirectoryHandle): string {
    return this.getLegacyIndexFileName(dirHandle?.name ?? "");
  }

  private getIndexFileNameFromPath(rootPath: string): string {
    return this.getIndexFileName(this.baseNameFromPath(rootPath));
  }

  private getLegacyIndexFileNameFromPath(rootPath: string): string {
    return this.getLegacyIndexFileName(this.baseNameFromPath(rootPath));
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

  private parentPathFromPath(pathValue: string): string {
    const raw = (pathValue ?? "").replace(/[\\/]+$/, "");
    const sep = raw.includes("\\") ? "\\" : "/";
    const idx = raw.lastIndexOf(sep);
    if (idx <= 0) return "";
    return raw.slice(0, idx);
  }

  private replacePathPrefix(pathValue: string, oldPrefix: string, nextPrefix: string): string {
    if (!pathValue) return pathValue;
    if (pathValue === oldPrefix) return nextPrefix;
    const sep = oldPrefix.includes("\\") ? "\\" : "/";
    const prefix = oldPrefix.endsWith(sep) ? oldPrefix : `${oldPrefix}${sep}`;
    if (pathValue.startsWith(prefix)) {
      return `${nextPrefix}${pathValue.slice(oldPrefix.length)}`;
    }
    return pathValue;
  }

  private splitRelPath(relPath: string): string[] {
    return (relPath ?? "")
      .split(/[\\/]/)
      .map((part) => part.trim())
      .filter(Boolean);
  }

  private async getDirectoryHandleByRelPath(
    rootHandle: FileSystemDirectoryHandle,
    relPath: string
  ): Promise<FileSystemDirectoryHandle> {
    let current = rootHandle;
    const parts = this.splitRelPath(relPath);
    for (const part of parts) {
      current = await current.getDirectoryHandle(part, { create: false });
    }
    return current;
  }

  private async getFileHandleByRelPath(
    rootHandle: FileSystemDirectoryHandle,
    relPath: string
  ): Promise<FileSystemFileHandle> {
    const parts = this.splitRelPath(relPath);
    const fileName = parts.pop();
    if (!fileName) {
      throw new Error("File path is missing a filename.");
    }
    const dirRel = parts.join("/");
    const dirHandle = dirRel
      ? await this.getDirectoryHandleByRelPath(rootHandle, dirRel)
      : rootHandle;
    return await dirHandle.getFileHandle(fileName, { create: false });
  }

  private findFolderById(
    nodes: IndexNode[],
    parentId: string
  ): IndexFolderNode | null {
    for (const node of nodes ?? []) {
      if (!node || typeof node !== "object") continue;
      if (this.isFolderNode(node)) {
        if (node.id === parentId) return node;
        const nested = this.findFolderById(node.child ?? [], parentId);
        if (nested) return nested;
      }
    }
    return null;
  }

  private findNodeById(nodes: IndexNode[], nodeId: string): IndexNode | null {
    for (const node of nodes ?? []) {
      if (!node || typeof node !== "object") continue;
      if (node.id === nodeId) return node;
      if (this.isFolderNode(node)) {
        const nested = this.findNodeById(node.child ?? [], nodeId);
        if (nested) return nested;
      }
    }
    return null;
  }

  private collectNodeIds(node: IndexNode | null, out: Set<string>) {
    if (!node) return;
    if (typeof node.id === "string") out.add(node.id);
    if (this.isFolderNode(node)) {
      (node.child ?? []).forEach((child) => this.collectNodeIds(child, out));
    }
  }

  private updateSubtreePaths(args: {
    node: IndexNode;
    oldPrefix: string;
    nextPrefix: string;
    now: string;
  }): IndexNode {
    const { node, oldPrefix, nextPrefix, now } = args;
    if (this.isFolderNode(node)) {
      const nextPath = this.replacePathPrefix(node.path, oldPrefix, nextPrefix);
      return {
        ...node,
        path: nextPath,
        updated_on: now,
        child: (node.child ?? []).map((child) =>
          this.updateSubtreePaths({ node: child, oldPrefix, nextPrefix, now })
        ),
      };
    }
    return {
      ...node,
      path: this.replacePathPrefix(node.path, oldPrefix, nextPrefix),
      updated_on: now,
    };
  }

  private renameFolderInTree(args: {
    nodes: IndexNode[];
    nodeId: string;
    newName: string;
    now: string;
  }): { nodes: IndexNode[]; renamed: IndexFolderNode | null; oldPath: string | null } {
    const { nodes, nodeId, newName, now } = args;
    let renamed: IndexFolderNode | null = null;
    let oldPath: string | null = null;
    const nextNodes = (nodes ?? []).map((node) => {
      if (!node || typeof node !== "object") return node;
      if (this.isFolderNode(node)) {
        if (node.id === nodeId) {
          oldPath = node.path;
          const parentPath = this.parentPathFromPath(node.path);
          const nextPath = parentPath
            ? this.joinPath(parentPath, newName)
            : this.joinRel("", newName);
          const updated = this.updateSubtreePaths({
            node: { ...node, name: newName, path: nextPath },
            oldPrefix: node.path,
            nextPrefix: nextPath,
            now,
          }) as IndexFolderNode;
          renamed = updated;
          return updated;
        }
        const nextChildren = this.renameFolderInTree({
          nodes: node.child ?? [],
          nodeId,
          newName,
          now,
        });
        if (nextChildren.renamed) {
          renamed = nextChildren.renamed;
          oldPath = nextChildren.oldPath;
          return { ...node, child: nextChildren.nodes };
        }
      }
      return node;
    });
    return { nodes: nextNodes, renamed, oldPath };
  }

  private removeFolderFromTree(args: {
    nodes: IndexNode[];
    nodeId: string;
  }): { nodes: IndexNode[]; removed: IndexNode | null } {
    const { nodes, nodeId } = args;
    let removed: IndexNode | null = null;
    const nextNodes = (nodes ?? []).filter((node) => {
      if (!node || typeof node !== "object") return false;
      if (node.id === nodeId) {
        removed = node;
        return false;
      }
      return true;
    }).map((node) => {
      if (this.isFolderNode(node)) {
        const next = this.removeFolderFromTree({
          nodes: node.child ?? [],
          nodeId,
        });
        if (next.removed) {
          removed = next.removed;
          return { ...node, child: next.nodes };
        }
      }
      return node;
    });
    return { nodes: nextNodes, removed };
  }

  private insertChildFolder(args: {
    nodes: IndexNode[];
    parentId: string;
    child: IndexFolderNode;
    now: string;
  }): { nodes: IndexNode[]; inserted: boolean } {
    const { nodes, parentId, child, now } = args;
    let inserted = false;
    const nextNodes = (nodes ?? []).map((node) => {
      if (!node || typeof node !== "object") return node;
      if (this.isFolderNode(node)) {
        if (node.id === parentId) {
          inserted = true;
          return {
            ...node,
            child: [...(node.child ?? []), child],
            updated_on: now,
          };
        }
        const nextChildren = this.insertChildFolder({
          nodes: node.child ?? [],
          parentId,
          child,
          now,
        });
        if (nextChildren.inserted) {
          inserted = true;
          return { ...node, child: nextChildren.nodes };
        }
      }
      return node;
    });
    return { nodes: nextNodes, inserted };
  }

  private insertChildFile(args: {
    nodes: IndexNode[];
    parentId: string;
    child: IndexFileNode;
    now: string;
  }): { nodes: IndexNode[]; inserted: boolean } {
    const { nodes, parentId, child, now } = args;
    let inserted = false;
    const nextNodes = (nodes ?? []).map((node) => {
      if (!node || typeof node !== "object") return node;
      if (this.isFolderNode(node)) {
        if (node.id === parentId) {
          inserted = true;
          return {
            ...node,
            child: [...(node.child ?? []), child],
            updated_on: now,
          };
        }
        const nextChildren = this.insertChildFile({
          nodes: node.child ?? [],
          parentId,
          child,
          now,
        });
        if (nextChildren.inserted) {
          inserted = true;
          return { ...node, child: nextChildren.nodes };
        }
      }
      return node;
    });
    return { nodes: nextNodes, inserted };
  }

  private renameFileInTree(args: {
    nodes: IndexNode[];
    nodeId: string;
    nextFileName: string;
    now: string;
  }): { nodes: IndexNode[]; renamed: IndexFileNode | null } {
    const { nodes, nodeId, nextFileName, now } = args;
    let renamed: IndexFileNode | null = null;
    const parts = this.splitFileName(nextFileName);
    const nextNodes = (nodes ?? []).map((node) => {
      if (!node || typeof node !== "object") return node;
      if (this.isFileNode(node) && node.id === nodeId) {
        const oldPath = node.path ?? "";
        const parentPath = this.parentPathFromPath(oldPath);
        const nextPath = parentPath
          ? this.joinPath(parentPath, nextFileName)
          : this.joinRel("", nextFileName);
        const updated: IndexFileNode = {
          ...node,
          name: parts.name,
          extension: parts.extension,
          path: nextPath,
          updated_on: now,
        };
        renamed = updated;
        return updated;
      }
      if (this.isFolderNode(node)) {
        const nested = this.renameFileInTree({
          nodes: node.child ?? [],
          nodeId,
          nextFileName,
          now,
        });
        if (nested.renamed) {
          renamed = nested.renamed;
          return { ...node, child: nested.nodes };
        }
      }
      return node;
    });
    return { nodes: nextNodes, renamed };
  }

  private resolveParentInfo(args: {
    root: RootFolderJson;
    parentNodeId: string;
  }): { level: number; path: string } | null {
    const { root, parentNodeId } = args;
    if (!parentNodeId) return null;
    if (parentNodeId === "00" || parentNodeId === root.id) {
      return { level: 0, path: typeof root.path === "string" ? root.path : "" };
    }
    const parentNode = this.findFolderById(root.child ?? [], parentNodeId);
    if (!parentNode) return null;
    return {
      level: typeof parentNode.level === "number" ? parentNode.level : 0,
      path: typeof parentNode.path === "string" ? parentNode.path : "",
    };
  }

  /**
   * Parses root folder index JSON and normalizes to the v1.0.0 schema.
   * Returns null when the payload is missing/invalid (treated as "no index").
   *
   * Note: Legacy schemas are allowed through if they contain compatible fields.
   */
  private parseRootFolderJsonV1(input: unknown): RootFolderJson | null {
    const obj = (input ?? {}) as any;
    if (!obj || typeof obj !== "object") return null;
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

    const rawPositions =
      obj && typeof obj.node_positions === "object" && obj.node_positions
        ? (obj.node_positions as Record<string, any>)
        : {};
    const node_positions: Record<string, { x: number; y: number }> = {};
    Object.entries(rawPositions).forEach(([key, value]) => {
      if (!value || typeof value !== "object") return;
      const x = (value as any).x;
      const y = (value as any).y;
      if (typeof x !== "number" || !Number.isFinite(x)) return;
      if (typeof y !== "number" || !Number.isFinite(y)) return;
      node_positions[key] = { x, y };
    });

    const rawSizes =
      obj && typeof obj.node_size === "object" && obj.node_size
        ? (obj.node_size as Record<string, any>)
        : {};
    const node_size: Record<string, number> = {};
    Object.entries(rawSizes).forEach(([key, value]) => {
      if (typeof value !== "number" || !Number.isFinite(value)) return;
      node_size[key] = value;
    });

    const rawFlowchartNodes = Array.isArray(obj.flowchart_nodes)
      ? (obj.flowchart_nodes as any[])
      : [];
    const flowchart_nodes: FlowchartNode[] = rawFlowchartNodes
      .filter((node) => node && typeof node === "object")
      .map((node) => ({
        id: typeof node.id === "string" ? node.id : "",
        type: typeof node.type === "string" ? node.type : "",
        name: typeof node.name === "string" ? node.name : "",
        purpose: typeof node.purpose === "string" ? node.purpose : "",
        created_on: typeof node.created_on === "string" ? node.created_on : "",
        updated_on:
          typeof node.updated_on === "string"
            ? node.updated_on
            : typeof node.created_on === "string"
            ? node.created_on
            : "",
      }))
      .filter((node) => node.id && node.type);

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
      node_positions,
      node_size,
      flowchart_nodes,
      child,
    };
  }

  private async readRootFolderJsonByName(
    dirHandle: FileSystemDirectoryHandle,
    fileName: string
  ): Promise<RootFolderJson | null> {
    try {
      const fileHandle = await dirHandle.getFileHandle(fileName, { create: false });
      const file = await fileHandle.getFile();
      const text = await file.text();
      const parsed = JSON.parse(text);
      return this.parseRootFolderJsonV1(parsed);
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotFoundError") return null;
      return null;
    }
  }

  private async findIndexFileCandidatesFromHandle(
    dirHandle: FileSystemDirectoryHandle
  ): Promise<string[]> {
    const names: string[] = [];
    for await (const entry of (dirHandle as any).values()) {
      if (entry?.kind !== "file") continue;
      if (typeof entry.name !== "string") continue;
      if (
        entry.name.endsWith(FileManager.ROOT_FILE_SUFFIX) ||
        entry.name.endsWith(FileManager.LEGACY_ROOT_SUFFIX)
      ) {
        names.push(entry.name);
      }
    }
    // Ensure legacy name is checked first if present.
    names.sort((a, b) => {
      if (a === FileManager.LEGACY_ROOT_FILE_NAME) return -1;
      if (b === FileManager.LEGACY_ROOT_FILE_NAME) return 1;
      return a.localeCompare(b);
    });
    return names;
  }

  private async findIndexFileCandidatesFromPath(dirPath: string): Promise<string[]> {
    try {
      const { readDir } = await import("@tauri-apps/plugin-fs");
      const entries = await readDir(dirPath);
      const names = entries
        .filter((e: any) => e?.isFile && typeof e.name === "string")
        .map((e: any) => e.name)
        .filter(
          (name: string) =>
            name.endsWith(FileManager.ROOT_FILE_SUFFIX) ||
            name.endsWith(FileManager.LEGACY_ROOT_SUFFIX)
        );
      names.sort((a, b) => {
        if (a === FileManager.LEGACY_ROOT_FILE_NAME) return -1;
        if (b === FileManager.LEGACY_ROOT_FILE_NAME) return 1;
        return a.localeCompare(b);
      });
      return names;
    } catch {
      return [];
    }
  }

  private async readRootFolderJsonFromPathByName(
    dirPath: string,
    fileName: string
  ): Promise<RootFolderJson | null> {
    try {
      const { exists, readTextFile } = await import("@tauri-apps/plugin-fs");
      const filePath = this.joinPath(dirPath, fileName);
      if (!(await exists(filePath))) return null;
      const text = await readTextFile(filePath);
      const parsed = JSON.parse(text);
      return this.parseRootFolderJsonV1(parsed);
    } catch {
      return null;
    }
  }

  private isFolderNode(node: IndexNode): node is IndexFolderNode {
    return (node as IndexFolderNode).child !== undefined;
  }

  private isFileNode(node: IndexNode): node is IndexFileNode {
    return (node as IndexFileNode).extension !== undefined;
  }

  private getNodeKey(node: IndexNode, parentPath: string): string {
    const parentKey = parentPath ?? "";
    if (this.isFolderNode(node)) {
      return `${parentKey}::folder::${node.name}`;
    }
    const ext = typeof node.extension === "string" ? node.extension : "";
    const fileName = ext ? `${node.name}.${ext}` : node.name;
    return `${parentKey}::file::${fileName}`;
  }

  private buildExistingChildMaps(
    existingChildren: IndexNode[],
    parentPath: string
  ): {
    byId: Map<string, IndexNode>;
    byPath: Map<string, IndexNode>;
    byKey: Map<string, IndexNode>;
  } {
    const byId = new Map<string, IndexNode>();
    const byPath = new Map<string, IndexNode>();
    const byKey = new Map<string, IndexNode>();
    for (const child of existingChildren ?? []) {
      if (!child || typeof child !== "object") continue;
      if (typeof child.id === "string" && child.id) {
        byId.set(child.id, child);
      }
      if (typeof child.path === "string" && child.path) {
        byPath.set(child.path, child);
      }
      const key = this.getNodeKey(child, parentPath);
      byKey.set(key, child);
    }
    return { byId, byPath, byKey };
  }

  private mergeNode(
    scanned: IndexNode,
    existing: IndexNode | null,
    now: string
  ): IndexNode {
    if (this.isFolderNode(scanned)) {
      const existingFolder = existing && this.isFolderNode(existing) ? existing : null;
      const nameChanged = !!existingFolder && existingFolder.name !== scanned.name;
      const createdOn = existingFolder?.created_on || now;
      const updatedOn = nameChanged ? now : existingFolder?.updated_on || now;
      const lastViewedOn = existingFolder?.last_viewed_on || createdOn;

      const merged: IndexFolderNode = {
        id: existingFolder?.id ?? this.generateUuid(),
        name: scanned.name,
        purpose: existingFolder?.purpose ?? "",
        type: scanned.type,
        level: scanned.level,
        path: scanned.path,
        created_on: createdOn,
        updated_on: updatedOn,
        last_viewed_on: lastViewedOn,
        views:
          typeof existingFolder?.views === "number" && Number.isFinite(existingFolder.views)
            ? existingFolder.views
            : 0,
        child: [],
      };

      const scannedChildren = Array.isArray(scanned.child) ? scanned.child : [];
      const existingChildren = existingFolder?.child ?? [];
      merged.child = this.mergeChildren(
        existingChildren,
        scannedChildren,
        scanned.path,
        now
      );
      return merged;
    }

    const scannedFile = scanned as IndexFileNode;
    const existingFile = existing && this.isFileNode(existing) ? existing : null;
    const nameChanged =
      !!existingFile &&
      (existingFile.name !== scannedFile.name ||
        existingFile.extension !== scannedFile.extension);
    const createdOn = existingFile?.created_on || now;
    const updatedOn = nameChanged ? now : existingFile?.updated_on || now;
    const lastViewedOn = existingFile?.last_viewed_on || createdOn;

    return {
      id: existingFile?.id ?? this.generateUuid(),
      name: scannedFile.name,
      extension: scannedFile.extension,
      purpose: existingFile?.purpose ?? "",
      type: scannedFile.type,
      level: scannedFile.level,
      path: scannedFile.path,
      created_on: createdOn,
      updated_on: updatedOn,
      last_viewed_on: lastViewedOn,
      views:
        typeof existingFile?.views === "number" && Number.isFinite(existingFile.views)
          ? existingFile.views
          : 0,
    };
  }

  private mergeChildren(
    existingChildren: IndexNode[],
    scannedChildren: IndexNode[],
    parentPath: string,
    now: string
  ): IndexNode[] {
    const { byId, byPath, byKey } = this.buildExistingChildMaps(
      existingChildren,
      parentPath
    );
    const usedIds = new Set<string>();

    return (scannedChildren ?? []).map((scanned) => {
      let match: IndexNode | undefined;
      if (scanned && typeof scanned.id === "string" && scanned.id) {
        match = byId.get(scanned.id);
      }
      if (!match && typeof scanned.path === "string" && scanned.path) {
        match = byPath.get(scanned.path);
      }
      if (!match) {
        const key = this.getNodeKey(scanned, parentPath);
        match = byKey.get(key);
      }
      if (match && typeof match.id === "string") {
        if (usedIds.has(match.id)) {
          match = undefined;
        } else {
          usedIds.add(match.id);
        }
      }
      return this.mergeNode(scanned, match ?? null, now);
    });
  }

  private mergeRootWithScan(args: {
    existing: RootFolderJson;
    scannedChildren: IndexNode[];
    rootName: string;
    rootPath: string;
    notifications: string[];
    now: string;
  }): RootFolderJson {
    const { existing, scannedChildren, rootName, rootPath, notifications, now } = args;
    const nameChanged = existing.name !== rootName;
    const createdOn = existing.created_on || now;
    const updatedOn = nameChanged ? now : existing.updated_on || now;
    const lastViewedOn = existing.last_viewed_on || createdOn;
    const mergedChildren = this.mergeChildren(
      existing.child ?? [],
      scannedChildren,
      rootPath,
      now
    );

    return {
      schema_version: "1.0.0",
      id: existing.id || this.generateUuid(),
      name: rootName,
      purpose: typeof existing.purpose === "string" ? existing.purpose : "",
      type: "root_folder",
      level: 0,
      path: rootPath,
      created_on: createdOn,
      updated_on: updatedOn,
      last_viewed_on: lastViewedOn,
      views:
        typeof existing.views === "number" && Number.isFinite(existing.views)
          ? existing.views
          : 0,
      notifications,
      recommendations: Array.isArray(existing.recommendations)
        ? existing.recommendations
        : [],
      error_messages: Array.isArray(existing.error_messages) ? existing.error_messages : [],
      node_positions:
        existing && typeof existing.node_positions === "object"
          ? (existing.node_positions as Record<string, { x: number; y: number }>)
          : {},
      node_size:
        existing && typeof existing.node_size === "object"
          ? (existing.node_size as Record<string, number>)
          : {},
      flowchart_nodes: Array.isArray(existing.flowchart_nodes)
        ? existing.flowchart_nodes
        : [],
      child: mergedChildren,
    };
  }

  private updateNodePurposeInTree(args: {
    nodes: IndexNode[];
    nodeId: string | null;
    nodePath: string | null;
    nextPurpose: string;
    now: string;
  }): { nodes: IndexNode[]; updated: boolean } {
    const { nodes, nodeId, nodePath, nextPurpose, now } = args;
    let updated = false;

    const walk = (list: IndexNode[]): IndexNode[] => {
      return list.map((node) => {
        const matchesId = !!nodeId && node.id === nodeId;
        const matchesPath =
          !!nodePath && typeof node.path === "string" && node.path === nodePath;
        if (matchesId || matchesPath) {
          const prevPurpose = typeof node.purpose === "string" ? node.purpose : "";
          const shouldUpdate = prevPurpose !== nextPurpose;
          updated = updated || shouldUpdate;
          if (this.isFolderNode(node)) {
            return {
              ...node,
              purpose: nextPurpose,
              updated_on: shouldUpdate ? now : node.updated_on,
              child: node.child ?? [],
            };
          }
          return {
            ...node,
            purpose: nextPurpose,
            updated_on: shouldUpdate ? now : node.updated_on,
          };
        }

        if (this.isFolderNode(node)) {
          const nextChildren = walk(node.child ?? []);
          if (nextChildren !== node.child) {
            return { ...node, child: nextChildren };
          }
        }
        return node;
      });
    };

    return { nodes: walk(nodes ?? []), updated };
  }

  private updateNodeTimestampInTree(args: {
    nodes: IndexNode[];
    nodeId: string | null;
    nodePath: string | null;
    now: string;
  }): { nodes: IndexNode[]; updated: boolean } {
    const { nodes, nodeId, nodePath, now } = args;
    let updated = false;

    const walk = (list: IndexNode[]): IndexNode[] => {
      return list.map((node) => {
        const matchesId = !!nodeId && node.id === nodeId;
        const matchesPath =
          !!nodePath && typeof node.path === "string" && node.path === nodePath;
        if (matchesId || matchesPath) {
          updated = true;
          if (this.isFolderNode(node)) {
            return {
              ...node,
              updated_on: now,
              child: node.child ?? [],
            };
          }
          return {
            ...node,
            updated_on: now,
          };
        }

        if (this.isFolderNode(node)) {
          const nextChildren = walk(node.child ?? []);
          if (nextChildren !== node.child) {
            return { ...node, child: nextChildren };
          }
        }
        return node;
      });
    };

    return { nodes: walk(nodes ?? []), updated };
  }

  async updateFileNodeTimestampFromHandle(args: {
    dirHandle: FileSystemDirectoryHandle;
    existing: RootFolderJson;
    nodeId: string | null;
    nodePath: string | null;
  }): Promise<RootFolderJson> {
    const { dirHandle, existing, nodeId, nodePath } = args;
    const now = this.nowIso();
    const result = this.updateNodeTimestampInTree({
      nodes: existing.child ?? [],
      nodeId,
      nodePath,
      now,
    });
    if (!result.updated) {
      return existing;
    }
    const updatedRoot: RootFolderJson = {
      ...existing,
      child: result.nodes,
      updated_on: now,
    };
    await this.writeRootFolderJson(dirHandle, updatedRoot);
    return updatedRoot;
  }

  async updateFileNodeTimestampFromPath(args: {
    dirPath: string;
    existing: RootFolderJson;
    nodeId: string | null;
    nodePath: string | null;
  }): Promise<RootFolderJson> {
    const { dirPath, existing, nodeId, nodePath } = args;
    const now = this.nowIso();
    const result = this.updateNodeTimestampInTree({
      nodes: existing.child ?? [],
      nodeId,
      nodePath,
      now,
    });
    if (!result.updated) {
      return existing;
    }
    const updatedRoot: RootFolderJson = {
      ...existing,
      child: result.nodes,
      path: dirPath,
      updated_on: now,
    };
    const indexFileName = this.getIndexFileNameFromPath(dirPath);
    await this.writeRootFolderJsonFromPathAtomic(dirPath, updatedRoot, indexFileName);
    return updatedRoot;
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
      node_positions: {},
      node_size: {},
      flowchart_nodes: [],
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
    const indexFileName = this.getIndexFileNameFromHandle(dirHandle);
    const legacyIndexFileName = this.getLegacyIndexFileNameFromHandle(dirHandle);
    // Web mode: root path is not available; use empty string.
    const root = this.buildNewRootFolderJson({ name: dirHandle.name, path: "", now });

    // Root notification: if any non-index FILE exists at root before initialization.
    for await (const entry of (dirHandle as any).values()) {
      if (
        entry.kind === "file" &&
        entry.name !== indexFileName &&
        entry.name !== legacyIndexFileName
      ) {
        root.notifications.push("Root folder contained files before initialization");
        break;
      }
    }

    // Build children (level 1).
    root.child = await this.scanDirectoryHandle(
      dirHandle,
      1,
      "",
      indexFileName,
      legacyIndexFileName,
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
    const indexFileName = this.getIndexFileName(rootName);
    const legacyIndexFileName = this.getLegacyIndexFileName(rootName);
    const root = this.buildNewRootFolderJson({ name: rootName, path: rootPath, now });

    try {
      const { readDir } = await import("@tauri-apps/plugin-fs");
      const entries = await readDir(rootPath);
      if (
        entries.some(
          (e: any) =>
            e?.isFile && e?.name !== indexFileName && e?.name !== legacyIndexFileName
        )
      ) {
        root.notifications.push("Root folder contained files before initialization");
      }
      root.child = await this.scanDirPath(
        rootPath,
        1,
        rootPath,
        indexFileName,
        legacyIndexFileName,
        root.notifications,
        now
      );
    } catch (err) {
      // If scanning fails, do not write partial results. Surface as root error message.
      root.error_messages.push(`Failed to scan root folder: ${String(err)}`);
      root.child = [];
    }

    await this.writeRootFolderJsonFromPathAtomic(rootPath, root, indexFileName);
    return root;
  }

  private async scanDirectoryHandle(
    dirHandle: FileSystemDirectoryHandle,
    level: number,
    parentRel: string,
    rootIndexFileName: string,
    legacyIndexFileName: string,
    rootNotifications: string[],
    now: string,
  ): Promise<IndexNode[]> {
    // If the branch is beyond max depth, do not create nodes.
    if (level > FileManager.MAX_LEVEL) return [];

    const nodes: IndexNode[] = [];

    // Prefer stable order: folders first, then files (by name).
    const dirs: FileSystemDirectoryHandle[] = [];
    const files: FileSystemFileHandle[] = [];
    for await (const entry of (dirHandle as any).values()) {
      if (level === 1) {
        if (entry.name === rootIndexFileName) continue;
        if (entry.name === legacyIndexFileName) continue;
      }
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
          rootIndexFileName,
          legacyIndexFileName,
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
    for await (const entry of (dirHandle as any).values()) {
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
    rootIndexFileName: string,
    legacyIndexFileName: string,
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
          rootIndexFileName,
          legacyIndexFileName,
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
      if (level === 1) {
        if (f.name === rootIndexFileName) continue;
        if (f.name === legacyIndexFileName) continue;
      }
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
    fileName?: string
  ): Promise<void> {
    const { writeTextFile, rename, remove } = await import("@tauri-apps/plugin-fs");
    const safeName = fileName ?? FileManager.LEGACY_ROOT_FILE_NAME;
    const finalPath = this.joinPath(dirPath, safeName);
    const tmpPath = this.joinPath(dirPath, `${safeName}.tmp`);
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
   * Reads <root>_rootIndex.json from the selected directory if it exists.
   * Returns null when the file does not exist or cannot be read.
   *
   * We keep failures silent by design (no alerts/toasts).
   */
  async readRootFolderJson(dirHandle: FileSystemDirectoryHandle): Promise<RootFolderJson | null> {
    const fileName = this.getIndexFileNameFromHandle(dirHandle);
    const current = await this.readRootFolderJsonByName(dirHandle, fileName);
    if (current) return current;

    const legacy = await this.readRootFolderJsonByName(
      dirHandle,
      FileManager.LEGACY_ROOT_FILE_NAME
    );
    if (legacy) {
      await this.writeRootFolderJsonToFileName(dirHandle, legacy, fileName);
      try {
        await dirHandle.removeEntry(FileManager.LEGACY_ROOT_FILE_NAME);
      } catch {
        // Silent by design.
      }
      return legacy;
    }

    const candidates = await this.findIndexFileCandidatesFromHandle(dirHandle);
    for (const candidate of candidates) {
      if (candidate === fileName) continue;
      const parsed = await this.readRootFolderJsonByName(dirHandle, candidate);
      if (!parsed) continue;
      await this.writeRootFolderJsonToFileName(dirHandle, parsed, fileName);
      try {
        await dirHandle.removeEntry(candidate);
      } catch {
        // Silent by design.
      }
      return parsed;
    }

    return null;
  }

  async getFileFromHandle(args: {
    rootHandle: FileSystemDirectoryHandle;
    relPath: string;
  }): Promise<File> {
    const { rootHandle, relPath } = args;
    const fileHandle = await this.getFileHandleByRelPath(rootHandle, relPath);
    return await fileHandle.getFile();
  }

  async readTextFileFromHandle(args: {
    rootHandle: FileSystemDirectoryHandle;
    relPath: string;
  }): Promise<{ content: string; mimeType: string }> {
    const file = await this.getFileFromHandle(args);
    const content = await file.text();
    return { content, mimeType: file.type ?? "" };
  }

  async readTextFileFromPath(filePath: string): Promise<string> {
    if (!filePath || typeof filePath !== "string") {
      throw new Error("File path is required.");
    }
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    return await readTextFile(filePath);
  }

  async writeTextFileFromHandle(args: {
    rootHandle: FileSystemDirectoryHandle;
    relPath: string;
    content: string;
  }): Promise<void> {
    const { rootHandle, relPath, content } = args;
    if (!relPath || typeof relPath !== "string") {
      throw new Error("File path is required.");
    }
    const fileHandle = await this.getFileHandleByRelPath(rootHandle, relPath);
    const writable = await (fileHandle as any).createWritable?.();
    if (!writable) {
      throw new Error("Failed to create writable file handle.");
    }
    try {
      await writable.write(content);
      await writable.close();
    } catch (error) {
      await writable.close().catch(() => {});
      throw error;
    }
  }

  async writeTextFileFromPath(filePath: string, content: string): Promise<void> {
    if (!filePath || typeof filePath !== "string") {
      throw new Error("File path is required.");
    }
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    await writeTextFile(filePath, content, { create: true });
  }

  /**
   * Loads existing rootIndex json if present; otherwise creates it.
   * This prevents "recreating" the root when the file already exists.
   */
  async loadOrCreateRootFolderJson(
    dirHandle: FileSystemDirectoryHandle,
  ): Promise<{ root: RootFolderJson; created: boolean }> {
    const existing = await this.readRootFolderJson(dirHandle);
    if (existing) {
      const updated = await this.syncRootFolderJsonFromHandle(dirHandle, existing);
      return { root: updated, created: false };
    }

    // Initialize by scanning the directory structure recursively up to 4 levels
    const createdRoot = await this.initializeIndexFromHandle(dirHandle);
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
   * Reads <root>_rootIndex.json from an absolute directory path (Tauri).
   * Returns null when missing/unreadable. Silent by design.
   */
  async readRootFolderJsonFromPath(dirPath: string): Promise<RootFolderJson | null> {
    const fileName = this.getIndexFileNameFromPath(dirPath);
    const current = await this.readRootFolderJsonFromPathByName(dirPath, fileName);
    if (current) return current;

    const legacy = await this.readRootFolderJsonFromPathByName(
      dirPath,
      FileManager.LEGACY_ROOT_FILE_NAME
    );
    if (legacy) {
      try {
        const { rename } = await import("@tauri-apps/plugin-fs");
        const legacyPath = this.joinPath(dirPath, FileManager.LEGACY_ROOT_FILE_NAME);
        const nextPath = this.joinPath(dirPath, fileName);
        await rename(legacyPath, nextPath);
      } catch {
        await this.writeRootFolderJsonFromPathAtomic(dirPath, legacy, fileName);
      }
      return legacy;
    }

    const candidates = await this.findIndexFileCandidatesFromPath(dirPath);
    for (const candidate of candidates) {
      if (candidate === fileName) continue;
      const parsed = await this.readRootFolderJsonFromPathByName(dirPath, candidate);
      if (!parsed) continue;
      try {
        const { rename } = await import("@tauri-apps/plugin-fs");
        const oldPath = this.joinPath(dirPath, candidate);
        const nextPath = this.joinPath(dirPath, fileName);
        await rename(oldPath, nextPath);
      } catch {
        await this.writeRootFolderJsonFromPathAtomic(dirPath, parsed, fileName);
      }
      return parsed;
    }

    return null;
  }

  async writeRootFolderJsonFromPath(dirPath: string, root: RootFolderJson): Promise<void> {
    if (!dirPath || typeof dirPath !== 'string' || dirPath.trim() === '') {
      console.error('[FileManager] writeRootFolderJsonFromPath: dirPath is empty or invalid', dirPath);
      throw new Error("Directory path is required for saving rootIndex json");
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
      node_positions:
        root && typeof root.node_positions === "object"
          ? (root.node_positions as Record<string, { x: number; y: number }>)
          : existing?.node_positions ?? {},
      node_size:
        root && typeof root.node_size === "object"
          ? (root.node_size as Record<string, number>)
          : existing?.node_size ?? {},
      flowchart_nodes: Array.isArray(root.flowchart_nodes)
        ? (root.flowchart_nodes as FlowchartNode[])
        : existing?.flowchart_nodes ?? [],
        child: Array.isArray(root.child) ? (root.child as IndexNode[]) : existing?.child ?? [],
      };

      const fileName = this.getIndexFileNameFromPath(dirPath);
      await this.writeRootFolderJsonFromPathAtomic(dirPath, normalized, fileName);
    } catch (error) {
      console.error("[FileManager] Failed to write rootIndex json:", error);
      throw error;
    }
  }

  async loadOrCreateRootFolderJsonFromPath(
    dirPath: string,
  ): Promise<{ root: RootFolderJson; created: boolean }> {
    if (!dirPath || typeof dirPath !== 'string' || dirPath.trim() === '') {
      throw new Error("Directory path is required for loading rootIndex json");
    }

    const existing = await this.readRootFolderJsonFromPath(dirPath);
    if (existing) {
      const updated = await this.syncRootFolderJsonFromPath(dirPath, existing);
      return { root: updated, created: false };
    }

    // Initialize by scanning the directory structure recursively up to 4 levels
    const createdRoot = await this.initializeIndexFromPath(dirPath);
    return { root: createdRoot, created: true };
  }

  /**
   * Creates (or overwrites) `<root>_rootIndex.json` in the selected folder with the strict initial structure.
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

  private async writeRootFolderJsonToFileName(
    dirHandle: FileSystemDirectoryHandle,
    root: RootFolderJson,
    fileName: string
  ): Promise<void> {
    const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(root, null, 2));
    await writable.close();
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
      node_positions:
        root && typeof root.node_positions === "object"
          ? (root.node_positions as Record<string, { x: number; y: number }>)
          : existing?.node_positions ?? {},
      node_size:
        root && typeof root.node_size === "object"
          ? (root.node_size as Record<string, number>)
          : existing?.node_size ?? {},
      flowchart_nodes: Array.isArray(root.flowchart_nodes)
        ? (root.flowchart_nodes as FlowchartNode[])
        : existing?.flowchart_nodes ?? [],
      child: Array.isArray(root.child) ? (root.child as IndexNode[]) : existing?.child ?? [],
    };

    const fileName = this.getIndexFileNameFromHandle(dirHandle);
    await this.writeRootFolderJsonToFileName(dirHandle, normalized, fileName);
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
   * Synchronizes the current state with the rootIndex json.
   * Ensures all changes are persisted to the master structure file.
   */
  sync(): void {
    // TODO: Implement sync logic
  }

  async updateNodePurposeFromHandle(args: {
    dirHandle: FileSystemDirectoryHandle;
    existing: RootFolderJson;
    nodeId: string | null;
    nodePath: string | null;
    nextPurpose: string;
  }): Promise<RootFolderJson> {
    const { dirHandle, existing, nodeId, nodePath, nextPurpose } = args;
    const now = this.nowIso();
    const result = this.updateNodePurposeInTree({
      nodes: existing.child ?? [],
      nodeId,
      nodePath,
      nextPurpose,
      now,
    });
    if (!result.updated) {
      return existing;
    }
    const updatedRoot: RootFolderJson = {
      ...existing,
      child: result.nodes,
    };
    await this.writeRootFolderJson(dirHandle, updatedRoot);
    return updatedRoot;
  }

  async updateNodePurposeFromPath(args: {
    dirPath: string;
    existing: RootFolderJson;
    nodeId: string | null;
    nodePath: string | null;
    nextPurpose: string;
  }): Promise<RootFolderJson> {
    const { dirPath, existing, nodeId, nodePath, nextPurpose } = args;
    const now = this.nowIso();
    const result = this.updateNodePurposeInTree({
      nodes: existing.child ?? [],
      nodeId,
      nodePath,
      nextPurpose,
      now,
    });
    if (!result.updated) {
      return existing;
    }
    const updatedRoot: RootFolderJson = {
      ...existing,
      child: result.nodes,
      path: dirPath,
    };
    const fileName = this.getIndexFileNameFromPath(dirPath);
    await this.writeRootFolderJsonFromPathAtomic(dirPath, updatedRoot, fileName);
    return updatedRoot;
  }

  async createFolderChildFromHandle(args: {
    dirHandle: FileSystemDirectoryHandle;
    existing: RootFolderJson;
    parentNodeId: string;
    name: string;
    purpose: string;
  }): Promise<{ root: RootFolderJson; node: IndexFolderNode }> {
    const { dirHandle, existing, parentNodeId, name, purpose } = args;
    const now = this.nowIso();
    const parentInfo = this.resolveParentInfo({
      root: existing,
      parentNodeId,
    });
    if (!parentInfo) throw new Error("Parent folder not found.");
    const nextLevel = parentInfo.level + 1;
    if (nextLevel > FileManager.MAX_LEVEL) {
      throw new Error("Maximum folder depth exceeded.");
    }

    const parentRelPath = parentInfo.path ?? "";
    const childRelPath = this.joinRel(parentRelPath, name);

    const parentHandle = await this.getDirectoryHandleByRelPath(
      dirHandle,
      parentRelPath
    );
    await parentHandle.getDirectoryHandle(name, { create: true });

    const childNode: IndexFolderNode = {
      id: this.generateUuid(),
      name,
      purpose: typeof purpose === "string" ? purpose : "",
      type: this.folderTypeForLevel(nextLevel),
      level: nextLevel as 1 | 2 | 3 | 4,
      path: childRelPath,
      created_on: now,
      updated_on: now,
      last_viewed_on: now,
      views: 0,
      child: [],
    };

    const parentIsRoot = parentNodeId === "00" || parentNodeId === existing.id;
    const updatedRoot = parentIsRoot
      ? {
          ...existing,
          updated_on: now,
          child: [...(existing.child ?? []), childNode],
        }
      : (() => {
          const updated = this.insertChildFolder({
            nodes: existing.child ?? [],
            parentId: parentNodeId,
            child: childNode,
            now,
          });
          if (!updated.inserted) {
            throw new Error("Parent folder not found.");
          }
          return { ...existing, updated_on: now, child: updated.nodes };
        })();

    await this.writeRootFolderJson(dirHandle, updatedRoot);
    return { root: updatedRoot, node: childNode };
  }

  async createFolderChildFromPath(args: {
    dirPath: string;
    existing: RootFolderJson;
    parentNodeId: string;
    name: string;
    purpose: string;
  }): Promise<{ root: RootFolderJson; node: IndexFolderNode }> {
    const { dirPath, existing, parentNodeId, name, purpose } = args;
    const now = this.nowIso();
    const parentInfo = this.resolveParentInfo({
      root: { ...existing, path: dirPath },
      parentNodeId,
    });
    if (!parentInfo) throw new Error("Parent folder not found.");
    const nextLevel = parentInfo.level + 1;
    if (nextLevel > FileManager.MAX_LEVEL) {
      throw new Error("Maximum folder depth exceeded.");
    }

    const parentAbsPath =
      parentNodeId === "00" || parentNodeId === existing.id
        ? dirPath
        : parentInfo.path ?? dirPath;
    const childAbsPath = this.joinPath(parentAbsPath, name);
    const { mkdir } = await import("@tauri-apps/plugin-fs");
    await mkdir(childAbsPath, { recursive: false });

    const childNode: IndexFolderNode = {
      id: this.generateUuid(),
      name,
      purpose: typeof purpose === "string" ? purpose : "",
      type: this.folderTypeForLevel(nextLevel),
      level: nextLevel as 1 | 2 | 3 | 4,
      path: childAbsPath,
      created_on: now,
      updated_on: now,
      last_viewed_on: now,
      views: 0,
      child: [],
    };

    const baseRoot = { ...existing, path: dirPath, updated_on: now };
    const parentIsRoot = parentNodeId === "00" || parentNodeId === existing.id;
    const updatedRoot = parentIsRoot
      ? { ...baseRoot, child: [...(baseRoot.child ?? []), childNode] }
      : (() => {
          const updated = this.insertChildFolder({
            nodes: baseRoot.child ?? [],
            parentId: parentNodeId,
            child: childNode,
            now,
          });
          if (!updated.inserted) {
            throw new Error("Parent folder not found.");
          }
          return { ...baseRoot, child: updated.nodes };
        })();

    const fileName = this.getIndexFileNameFromPath(dirPath);
    await this.writeRootFolderJsonFromPathAtomic(dirPath, updatedRoot, fileName);
    return { root: updatedRoot, node: childNode };
  }

  async renameFolderChildFromPath(args: {
    dirPath: string;
    existing: RootFolderJson;
    nodeId: string;
    newName: string;
  }): Promise<{ root: RootFolderJson; node: IndexFolderNode }> {
    const { dirPath, existing, nodeId, newName } = args;
    const now = this.nowIso();
    const target = this.findNodeById(existing.child ?? [], nodeId);
    if (!target || !this.isFolderNode(target)) {
      throw new Error("Folder node not found.");
    }
    const oldPath = target.path;
    if (!oldPath) throw new Error("Folder path not found.");
    const parentPath = this.parentPathFromPath(oldPath);
    const nextPath = parentPath ? this.joinPath(parentPath, newName) : this.joinRel("", newName);

    const { rename } = await import("@tauri-apps/plugin-fs");
    await rename(oldPath, nextPath);

    const updated = this.renameFolderInTree({
      nodes: existing.child ?? [],
      nodeId,
      newName,
      now,
    });
    if (!updated.renamed || !updated.oldPath) {
      throw new Error("Folder node not found.");
    }
    const updatedRoot: RootFolderJson = {
      ...existing,
      path: dirPath,
      updated_on: now,
      child: updated.nodes,
    };
    const fileName = this.getIndexFileNameFromPath(dirPath);
    await this.writeRootFolderJsonFromPathAtomic(dirPath, updatedRoot, fileName);
    return { root: updatedRoot, node: updated.renamed };
  }

  async deleteFolderChildFromPath(args: {
    dirPath: string;
    existing: RootFolderJson;
    nodeId: string;
  }): Promise<{ root: RootFolderJson; removedIds: string[] }> {
    const { dirPath, existing, nodeId } = args;
    const now = this.nowIso();
    const target = this.findNodeById(existing.child ?? [], nodeId);
    if (!target || !this.isFolderNode(target)) {
      throw new Error("Folder node not found.");
    }
    const targetPath = target.path;
    if (!targetPath) throw new Error("Folder path not found.");
    const { remove } = await import("@tauri-apps/plugin-fs");
    await remove(targetPath, { recursive: true });

    const removedIds = new Set<string>();
    this.collectNodeIds(target, removedIds);
    const updated = this.removeFolderFromTree({
      nodes: existing.child ?? [],
      nodeId,
    });
    if (!updated.removed) {
      throw new Error("Folder node not found.");
    }
    const nextPositions = { ...(existing.node_positions ?? {}) };
    const nextSizes = { ...(existing.node_size ?? {}) };
    removedIds.forEach((id) => {
      delete nextPositions[id];
      delete nextSizes[id];
    });
    const updatedRoot: RootFolderJson = {
      ...existing,
      path: dirPath,
      updated_on: now,
      child: updated.nodes,
      node_positions: nextPositions,
      node_size: nextSizes,
    };
    const fileName = this.getIndexFileNameFromPath(dirPath);
    await this.writeRootFolderJsonFromPathAtomic(dirPath, updatedRoot, fileName);
    return { root: updatedRoot, removedIds: Array.from(removedIds) };
  }

  async createFileChildFromHandle(args: {
    dirHandle: FileSystemDirectoryHandle;
    existing: RootFolderJson;
    parentNodeId: string;
    fileName: string; // includes extension if provided
    purpose: string;
  }): Promise<{ root: RootFolderJson; node: IndexFileNode }> {
    const { dirHandle, existing, parentNodeId, fileName, purpose } = args;
    const now = this.nowIso();
    const parentInfo = this.resolveParentInfo({
      root: existing,
      parentNodeId,
    });
    if (!parentInfo) throw new Error("Parent folder not found.");
    const nextLevel = parentInfo.level + 1;
    if (nextLevel > FileManager.MAX_LEVEL) {
      throw new Error("Maximum folder depth exceeded.");
    }

    const parentRelPath = parentInfo.path ?? "";
    const childRelPath = this.joinRel(parentRelPath, fileName);
    const parentHandle = await this.getDirectoryHandleByRelPath(
      dirHandle,
      parentRelPath
    );

    const fh = await parentHandle.getFileHandle(fileName, { create: true });
    // Best-effort: ensure the file exists on disk (some implementations require a write).
    try {
      const writable = await (fh as any).createWritable?.();
      if (writable) {
        await writable.write("");
        await writable.close();
      }
    } catch {
      // Ignore; file handle creation is the primary intent.
    }

    const parts = this.splitFileName(fileName);
    const childNode: IndexFileNode = {
      id: this.generateUuid(),
      name: parts.name,
      extension: parts.extension,
      purpose: typeof purpose === "string" ? purpose : "",
      type: this.fileTypeForLevel(nextLevel),
      level: nextLevel as 1 | 2 | 3 | 4,
      path: childRelPath,
      created_on: now,
      updated_on: now,
      last_viewed_on: now,
      views: 0,
    };

    const parentIsRoot = parentNodeId === "00" || parentNodeId === existing.id;
    const updatedRoot = parentIsRoot
      ? {
          ...existing,
          updated_on: now,
          child: [...(existing.child ?? []), childNode],
        }
      : (() => {
          const updated = this.insertChildFile({
            nodes: existing.child ?? [],
            parentId: parentNodeId,
            child: childNode,
            now,
          });
          if (!updated.inserted) {
            throw new Error("Parent folder not found.");
          }
          return { ...existing, updated_on: now, child: updated.nodes };
        })();

    await this.writeRootFolderJson(dirHandle, updatedRoot);
    return { root: updatedRoot, node: childNode };
  }

  async createFileChildFromPath(args: {
    dirPath: string;
    existing: RootFolderJson;
    parentNodeId: string;
    fileName: string; // includes extension if provided
    purpose: string;
  }): Promise<{ root: RootFolderJson; node: IndexFileNode }> {
    const { dirPath, existing, parentNodeId, fileName, purpose } = args;
    const now = this.nowIso();
    const parentInfo = this.resolveParentInfo({
      root: { ...existing, path: dirPath },
      parentNodeId,
    });
    if (!parentInfo) throw new Error("Parent folder not found.");
    const nextLevel = parentInfo.level + 1;
    if (nextLevel > FileManager.MAX_LEVEL) {
      throw new Error("Maximum folder depth exceeded.");
    }

    const parentAbsPath =
      parentNodeId === "00" || parentNodeId === existing.id
        ? dirPath
        : parentInfo.path ?? dirPath;
    const childAbsPath = this.joinPath(parentAbsPath, fileName);

    const { exists, writeTextFile } = await import("@tauri-apps/plugin-fs");
    if (await exists(childAbsPath)) {
      throw new Error("File already exists.");
    }
    await writeTextFile(childAbsPath, "", { create: true });

    const parts = this.splitFileName(fileName);
    const childNode: IndexFileNode = {
      id: this.generateUuid(),
      name: parts.name,
      extension: parts.extension,
      purpose: typeof purpose === "string" ? purpose : "",
      type: this.fileTypeForLevel(nextLevel),
      level: nextLevel as 1 | 2 | 3 | 4,
      path: childAbsPath,
      created_on: now,
      updated_on: now,
      last_viewed_on: now,
      views: 0,
    };

    const baseRoot = { ...existing, path: dirPath, updated_on: now };
    const parentIsRoot = parentNodeId === "00" || parentNodeId === existing.id;
    const updatedRoot = parentIsRoot
      ? { ...baseRoot, child: [...(baseRoot.child ?? []), childNode] }
      : (() => {
          const updated = this.insertChildFile({
            nodes: baseRoot.child ?? [],
            parentId: parentNodeId,
            child: childNode,
            now,
          });
          if (!updated.inserted) {
            throw new Error("Parent folder not found.");
          }
          return { ...baseRoot, child: updated.nodes };
        })();

    const indexFileName = this.getIndexFileNameFromPath(dirPath);
    await this.writeRootFolderJsonFromPathAtomic(dirPath, updatedRoot, indexFileName);
    return { root: updatedRoot, node: childNode };
  }

  async renameFileChildFromPath(args: {
    dirPath: string;
    existing: RootFolderJson;
    nodeId: string;
    nextFileName: string; // includes extension if provided
  }): Promise<{ root: RootFolderJson; node: IndexFileNode }> {
    const { dirPath, existing, nodeId, nextFileName } = args;
    const now = this.nowIso();
    const target = this.findNodeById(existing.child ?? [], nodeId);
    if (!target || !this.isFileNode(target)) {
      throw new Error("File node not found.");
    }
    const oldPath = target.path;
    if (!oldPath) throw new Error("File path not found.");
    const parentPath = this.parentPathFromPath(oldPath);
    const nextPath = parentPath
      ? this.joinPath(parentPath, nextFileName)
      : this.joinRel("", nextFileName);

    const { rename } = await import("@tauri-apps/plugin-fs");
    await rename(oldPath, nextPath);

    const updated = this.renameFileInTree({
      nodes: existing.child ?? [],
      nodeId,
      nextFileName,
      now,
    });
    if (!updated.renamed) {
      throw new Error("File node not found.");
    }

    const updatedRoot: RootFolderJson = {
      ...existing,
      path: dirPath,
      updated_on: now,
      child: updated.nodes,
    };
    const indexFileName = this.getIndexFileNameFromPath(dirPath);
    await this.writeRootFolderJsonFromPathAtomic(dirPath, updatedRoot, indexFileName);
    return { root: updatedRoot, node: updated.renamed };
  }

  async deleteFileChildFromPath(args: {
    dirPath: string;
    existing: RootFolderJson;
    nodeId: string;
  }): Promise<{ root: RootFolderJson; removedIds: string[] }> {
    const { dirPath, existing, nodeId } = args;
    const now = this.nowIso();
    const target = this.findNodeById(existing.child ?? [], nodeId);
    if (!target || !this.isFileNode(target)) {
      throw new Error("File node not found.");
    }
    const targetPath = target.path;
    if (!targetPath) throw new Error("File path not found.");

    const { remove } = await import("@tauri-apps/plugin-fs");
    await remove(targetPath, { recursive: false });

    const updated = this.removeFolderFromTree({
      nodes: existing.child ?? [],
      nodeId,
    });
    if (!updated.removed) {
      throw new Error("File node not found.");
    }

    const nextPositions = { ...(existing.node_positions ?? {}) };
    const nextSizes = { ...(existing.node_size ?? {}) };
    delete nextPositions[nodeId];
    delete nextSizes[nodeId];

    const updatedRoot: RootFolderJson = {
      ...existing,
      path: dirPath,
      updated_on: now,
      child: updated.nodes,
      node_positions: nextPositions,
      node_size: nextSizes,
    };
    const indexFileName = this.getIndexFileNameFromPath(dirPath);
    await this.writeRootFolderJsonFromPathAtomic(dirPath, updatedRoot, indexFileName);
    return { root: updatedRoot, removedIds: [nodeId] };
  }

  async createImageFileChildFromHandle(args: {
    dirHandle: FileSystemDirectoryHandle;
    existing: RootFolderJson;
    parentNodeId: string;
    fileName: string; // includes extension
    imageFile: File;
    caption?: string;
    purpose?: string;
  }): Promise<{ root: RootFolderJson; node: IndexFileNode }> {
    const { dirHandle, existing, parentNodeId, fileName, imageFile, caption, purpose } = args;
    const now = this.nowIso();
    const parentInfo = this.resolveParentInfo({
      root: existing,
      parentNodeId,
    });
    if (!parentInfo) throw new Error("Parent folder not found.");
    const nextLevel = parentInfo.level + 1;
    if (nextLevel > FileManager.MAX_LEVEL) {
      throw new Error("Maximum folder depth exceeded.");
    }

    const parentRelPath = parentInfo.path ?? "";
    const childRelPath = this.joinRel(parentRelPath, fileName);
    const parentHandle = await this.getDirectoryHandleByRelPath(
      dirHandle,
      parentRelPath
    );

    const fh = await parentHandle.getFileHandle(fileName, { create: true });
    const writable = await (fh as any).createWritable?.();
    if (writable) {
      await writable.write(imageFile);
      await writable.close();
    } else {
      throw new Error("Failed to create image file.");
    }

    const parts = this.splitFileName(fileName);
    const childNode: IndexFileNode = {
      id: this.generateUuid(),
      name: parts.name,
      extension: parts.extension,
      purpose: typeof purpose === "string" ? purpose : (typeof caption === "string" ? caption : ""),
      type: this.fileTypeForLevel(nextLevel),
      level: nextLevel as 1 | 2 | 3 | 4,
      path: childRelPath,
      created_on: now,
      updated_on: now,
      last_viewed_on: now,
      views: 0,
    };

    const parentIsRoot = parentNodeId === "00" || parentNodeId === existing.id;
    const updatedRoot = parentIsRoot
      ? {
          ...existing,
          updated_on: now,
          child: [...(existing.child ?? []), childNode],
        }
      : (() => {
          const updated = this.insertChildFile({
            nodes: existing.child ?? [],
            parentId: parentNodeId,
            child: childNode,
            now,
          });
          if (!updated.inserted) {
            throw new Error("Parent folder not found.");
          }
          return { ...existing, updated_on: now, child: updated.nodes };
        })();

    await this.writeRootFolderJson(dirHandle, updatedRoot);
    return { root: updatedRoot, node: childNode };
  }

  async createImageFileChildFromPath(args: {
    dirPath: string;
    existing: RootFolderJson;
    parentNodeId: string;
    fileName: string; // includes extension
    imageFile: File;
    caption?: string;
    purpose?: string;
  }): Promise<{ root: RootFolderJson; node: IndexFileNode }> {
    const { dirPath, existing, parentNodeId, fileName, imageFile, caption, purpose } = args;
    const now = this.nowIso();
    const parentInfo = this.resolveParentInfo({
      root: { ...existing, path: dirPath },
      parentNodeId,
    });
    if (!parentInfo) throw new Error("Parent folder not found.");
    const nextLevel = parentInfo.level + 1;
    if (nextLevel > FileManager.MAX_LEVEL) {
      throw new Error("Maximum folder depth exceeded.");
    }

    const parentAbsPath =
      parentNodeId === "00" || parentNodeId === existing.id
        ? dirPath
        : parentInfo.path ?? dirPath;
    const childAbsPath = this.joinPath(parentAbsPath, fileName);

    const { exists, writeFile } = await import("@tauri-apps/plugin-fs");
    if (await exists(childAbsPath)) {
      throw new Error("File already exists.");
    }
    const arrayBuffer = await imageFile.arrayBuffer();
    await writeFile(childAbsPath, new Uint8Array(arrayBuffer));

    const parts = this.splitFileName(fileName);
    const childNode: IndexFileNode = {
      id: this.generateUuid(),
      name: parts.name,
      extension: parts.extension,
      purpose: typeof purpose === "string" ? purpose : (typeof caption === "string" ? caption : ""),
      type: this.fileTypeForLevel(nextLevel),
      level: nextLevel as 1 | 2 | 3 | 4,
      path: childAbsPath,
      created_on: now,
      updated_on: now,
      last_viewed_on: now,
      views: 0,
    };

    const baseRoot = { ...existing, path: dirPath, updated_on: now };
    const parentIsRoot = parentNodeId === "00" || parentNodeId === existing.id;
    const updatedRoot = parentIsRoot
      ? { ...baseRoot, child: [...(baseRoot.child ?? []), childNode] }
      : (() => {
          const updated = this.insertChildFile({
            nodes: baseRoot.child ?? [],
            parentId: parentNodeId,
            child: childNode,
            now,
          });
          if (!updated.inserted) {
            throw new Error("Parent folder not found.");
          }
          return { ...baseRoot, child: updated.nodes };
        })();

    const indexFileName = this.getIndexFileNameFromPath(dirPath);
    await this.writeRootFolderJsonFromPathAtomic(dirPath, updatedRoot, indexFileName);
    return { root: updatedRoot, node: childNode };
  }

  async appendRootErrorMessageFromHandle(args: {
    dirHandle: FileSystemDirectoryHandle;
    existing: RootFolderJson | null;
    message: string;
  }): Promise<void> {
    const { dirHandle, existing, message } = args;
    if (!message) return;
    const now = this.nowIso();
    const root = existing ?? this.buildNewRootFolderJson({ name: dirHandle.name, path: "", now });
    const nextErrors = Array.isArray(root.error_messages) ? [...root.error_messages] : [];
    nextErrors.push(message);
    try {
      await this.writeRootFolderJson(dirHandle, { ...root, error_messages: nextErrors });
    } catch {
      // Silent by UX rules.
    }
  }

  async appendRootErrorMessageFromPath(args: {
    dirPath: string;
    existing: RootFolderJson | null;
    message: string;
  }): Promise<void> {
    const { dirPath, existing, message } = args;
    if (!message) return;
    const now = this.nowIso();
    const rootName = this.baseNameFromPath(dirPath);
    const root = existing ?? this.buildNewRootFolderJson({ name: rootName, path: dirPath, now });
    const nextErrors = Array.isArray(root.error_messages) ? [...root.error_messages] : [];
    nextErrors.push(message);
    try {
      const fileName = this.getIndexFileName(rootName);
      await this.writeRootFolderJsonFromPathAtomic(
        dirPath,
        { ...root, error_messages: nextErrors },
        fileName
      );
    } catch {
      // Silent by UX rules.
    }
  }

  /**
   * Merge filesystem changes into an existing index (browser mode).
   */
  async syncRootFolderJsonFromHandle(
    dirHandle: FileSystemDirectoryHandle,
    existing: RootFolderJson
  ): Promise<RootFolderJson> {
    const now = this.nowIso();
    const rootName = dirHandle.name;
    const indexFileName = this.getIndexFileName(rootName);
    const legacyIndexFileName = this.getLegacyIndexFileName(rootName);
    const notifications = Array.isArray(existing.notifications)
      ? [...existing.notifications]
      : [];

    // Add root notification if any non-index file exists at root.
    let hasRootFile = false;
    for await (const entry of (dirHandle as any).values()) {
      if (
        entry.kind === "file" &&
        entry.name !== indexFileName &&
        entry.name !== legacyIndexFileName
      ) {
        hasRootFile = true;
        break;
      }
    }
    if (hasRootFile) {
      const note = "Root folder contained files before initialization";
      if (!notifications.includes(note)) notifications.push(note);
    }

    try {
      const scannedChildren = await this.scanDirectoryHandle(
        dirHandle,
        1,
        "",
        indexFileName,
        legacyIndexFileName,
        notifications,
        now
      );
      const merged = this.mergeRootWithScan({
        existing,
        scannedChildren,
        rootName,
        rootPath: "",
        notifications,
        now,
      });
      await this.writeRootFolderJson(dirHandle, merged);
      return merged;
    } catch (err) {
      const nextErrors = Array.isArray(existing.error_messages)
        ? [...existing.error_messages]
        : [];
      nextErrors.push(`Failed to sync root folder: ${String(err)}`);
      return { ...existing, error_messages: nextErrors };
    }
  }

  /**
   * Merge filesystem changes into an existing index (desktop path mode).
   */
  async syncRootFolderJsonFromPath(
    dirPath: string,
    existing: RootFolderJson
  ): Promise<RootFolderJson> {
    const now = this.nowIso();
    const rootName = this.baseNameFromPath(dirPath);
    const indexFileName = this.getIndexFileName(rootName);
    const legacyIndexFileName = this.getLegacyIndexFileName(rootName);
    const notifications = Array.isArray(existing.notifications)
      ? [...existing.notifications]
      : [];

    try {
      const { readDir } = await import("@tauri-apps/plugin-fs");
      const entries = await readDir(dirPath);
      if (
        entries.some(
          (e: any) =>
            e?.isFile && e?.name !== indexFileName && e?.name !== legacyIndexFileName
        )
      ) {
        const note = "Root folder contained files before initialization";
        if (!notifications.includes(note)) notifications.push(note);
      }
      const scannedChildren = await this.scanDirPath(
        dirPath,
        1,
        dirPath,
        indexFileName,
        legacyIndexFileName,
        notifications,
        now
      );
      const merged = this.mergeRootWithScan({
        existing,
        scannedChildren,
        rootName,
        rootPath: dirPath,
        notifications,
        now,
      });
      await this.writeRootFolderJsonFromPathAtomic(dirPath, merged, indexFileName);
      return merged;
    } catch (err) {
      const nextErrors = Array.isArray(existing.error_messages)
        ? [...existing.error_messages]
        : [];
      nextErrors.push(`Failed to sync root folder: ${String(err)}`);
      return { ...existing, error_messages: nextErrors, path: dirPath };
    }
  }
}
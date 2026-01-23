export type CognitiveNotesFileNode = {
  id: string;
  name: string;
  extension: string;
  purpose: string;
  type: "file_A";
  level: 1;
  path: string;
  created_on: string;
  updated_on: string;
  last_viewed_on: string;
  views: number;
  related_nodes: CognitiveNotesRelation[];
  sort_index: number | null;
};

export type CognitiveNotesRelation = {
  edge_id: string;
  target_id: string;
  purpose: string;
  source_handle?: string;
  target_handle?: string;
};

export type CognitiveNotesJson = {
  schema_version: "1.0.0";
  id: string;
  name: string;
  purpose: string;
  type: "root_folder";
  level: 0;
  path: string;
  created_on: string;
  updated_on: string;
  last_viewed_on: string;
  views: number;
  notifications: string[];
  recommendations: string[];
  error_messages: string[];
  node_positions: Record<string, { x: number; y: number }>;
  node_size: Record<string, number>;
  child: CognitiveNotesFileNode[];
};

export class CognitiveNotesManager {
  private static FILE_SUFFIX = "_cognitiveNotes.json" as const;
  private static ROOT_INDEX_SUFFIX = "_rootIndex.json" as const;

  private nowIso(): string {
    return new Date().toISOString();
  }

  private generateUuid(): string {
    const c = (globalThis as any)?.crypto;
    if (c?.randomUUID) return c.randomUUID();
    return `pm_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }

  private isTauri(): boolean {
    return typeof (window as any).__TAURI_INTERNALS__ !== "undefined";
  }

  private joinPath(dirPath: string, fileName: string): string {
    const trimmed = dirPath.replace(/[\\/]+$/, "");
    const sep = trimmed.includes("\\") ? "\\" : "/";
    return `${trimmed}${sep}${fileName}`;
  }

  private baseNameFromPath(dirPath: string): string {
    const trimmed = dirPath.replace(/[\\/]+$/, "");
    const parts = trimmed.split(/[\\/]/);
    return parts[parts.length - 1] || trimmed;
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

  private getIndexFileName(rootName: string): string {
    const trimmed = (rootName ?? "").trim();
    return `${trimmed || "root"}${CognitiveNotesManager.FILE_SUFFIX}`;
  }

  private getIndexFileNameFromHandle(dirHandle: FileSystemDirectoryHandle): string {
    return this.getIndexFileName(dirHandle?.name ?? "");
  }

  private getIndexFileNameFromPath(rootPath: string): string {
    return this.getIndexFileName(this.baseNameFromPath(rootPath));
  }

  private buildMarkerFileName(prefix: "start" | "end", rootName: string): string {
    const trimmed = (rootName ?? "").trim();
    const safeRoot = trimmed || "root";
    return `${prefix}_${safeRoot}.md`;
  }

  private shouldSkipFileName(fileName: string): boolean {
    if (!fileName || typeof fileName !== "string") return true;
    return (
      fileName.endsWith(CognitiveNotesManager.FILE_SUFFIX) ||
      fileName.endsWith(CognitiveNotesManager.ROOT_INDEX_SUFFIX)
    );
  }

  private getNodeKey(node: CognitiveNotesFileNode, parentPath: string): string {
    const parentKey = parentPath ?? "";
    const fileName = node.extension
      ? `${node.name}.${node.extension}`
      : node.name;
    return `${parentKey}::file::${fileName}`;
  }

  private parseCognitiveNotesJsonV1(input: unknown): CognitiveNotesJson | null {
    const obj = (input ?? {}) as any;
    if (!obj || typeof obj !== "object") return null;
    if (obj.type !== "root_folder") return null;
    if (obj.level !== 0) return null;

    const requiredString = (v: unknown) => typeof v === "string" && v.trim().length > 0;
    if (!requiredString(obj.id)) return null;
    if (!requiredString(obj.name)) return null;

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

    const rawChild = Array.isArray(obj.child)
      ? (obj.child as CognitiveNotesFileNode[])
      : Array.isArray(obj.related_nodes)
      ? (obj.related_nodes as CognitiveNotesFileNode[])
      : [];
    const child = this.normalizeChildNodes(rawChild);

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
      child,
    };
  }

  private buildNewRootJson(args: { name: string; path: string; now?: string }): CognitiveNotesJson {
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
      child: [],
    };
  }

  private normalizeChildNodes(nodes: CognitiveNotesFileNode[]): CognitiveNotesFileNode[] {
    return (nodes ?? []).map((node) => {
      const related_nodes = Array.isArray((node as any).related_nodes)
        ? (node as any).related_nodes
        : [];
      const sort_index =
        typeof (node as any).sort_index === "number" &&
        Number.isFinite((node as any).sort_index)
          ? (node as any).sort_index
          : null;
      return {
        ...(node as any),
        related_nodes,
        sort_index,
      } as CognitiveNotesFileNode;
    });
  }

  private buildExistingNodeMaps(
    existingNodes: CognitiveNotesFileNode[],
    parentPath: string
  ): {
    byId: Map<string, CognitiveNotesFileNode>;
    byPath: Map<string, CognitiveNotesFileNode>;
    byKey: Map<string, CognitiveNotesFileNode>;
  } {
    const byId = new Map<string, CognitiveNotesFileNode>();
    const byPath = new Map<string, CognitiveNotesFileNode>();
    const byKey = new Map<string, CognitiveNotesFileNode>();
    for (const node of existingNodes ?? []) {
      if (!node || typeof node !== "object") continue;
      if (typeof node.id === "string" && node.id) {
        byId.set(node.id, node);
      }
      if (typeof node.path === "string" && node.path) {
        byPath.set(node.path, node);
      }
      const key = this.getNodeKey(node, parentPath);
      byKey.set(key, node);
    }
    return { byId, byPath, byKey };
  }

  private mergeNode(
    scanned: CognitiveNotesFileNode,
    existing: CognitiveNotesFileNode | null,
    now: string
  ): CognitiveNotesFileNode {
    const nameChanged =
      !!existing &&
      (existing.name !== scanned.name || existing.extension !== scanned.extension);
    const createdOn = existing?.created_on || now;
    const updatedOn = nameChanged ? now : existing?.updated_on || now;
    const lastViewedOn = existing?.last_viewed_on || createdOn;

    return {
      id: existing?.id ?? this.generateUuid(),
      name: scanned.name,
      extension: scanned.extension,
      purpose: existing?.purpose ?? "",
      type: "file_A",
      level: 1,
      path: scanned.path,
      created_on: createdOn,
      updated_on: updatedOn,
      last_viewed_on: lastViewedOn,
      views:
        typeof existing?.views === "number" && Number.isFinite(existing.views)
          ? existing.views
          : 0,
      related_nodes: Array.isArray(existing?.related_nodes)
        ? existing!.related_nodes
        : Array.isArray(scanned.related_nodes)
        ? scanned.related_nodes
        : [],
      sort_index:
        typeof existing?.sort_index === "number" && Number.isFinite(existing.sort_index)
          ? existing.sort_index
          : typeof scanned.sort_index === "number" && Number.isFinite(scanned.sort_index)
          ? scanned.sort_index
          : null,
    };
  }

  private mergeNodes(
    existingNodes: CognitiveNotesFileNode[],
    scannedNodes: CognitiveNotesFileNode[],
    parentPath: string,
    now: string
  ): CognitiveNotesFileNode[] {
    const { byId, byPath, byKey } = this.buildExistingNodeMaps(
      existingNodes,
      parentPath
    );
    const usedIds = new Set<string>();

    return (scannedNodes ?? []).map((scanned) => {
      let match: CognitiveNotesFileNode | undefined;
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
    existing: CognitiveNotesJson;
    scannedNodes: CognitiveNotesFileNode[];
    rootName: string;
    rootPath: string;
    notifications: string[];
    now: string;
  }): CognitiveNotesJson {
    const { existing, scannedNodes, rootName, rootPath, notifications, now } = args;
    const nameChanged = existing.name !== rootName;
    const createdOn = existing.created_on || now;
    const updatedOn = nameChanged ? now : existing.updated_on || now;
    const lastViewedOn = existing.last_viewed_on || createdOn;
    const mergedNodes = this.mergeNodes(
      existing.child ?? [],
      scannedNodes,
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
      child: mergedNodes,
    };
  }

  private async scanDirectoryHandleFiles(
    dirHandle: FileSystemDirectoryHandle,
    rootNotifications: string[],
    now: string
  ): Promise<CognitiveNotesFileNode[]> {
    const nodes: CognitiveNotesFileNode[] = [];
    const files: FileSystemFileHandle[] = [];

    for await (const entry of (dirHandle as any).values()) {
      if (entry.kind === "directory") {
        rootNotifications.push(`Subfolder ignored at ${entry.name}`);
        continue;
      }
      if (entry.kind === "file" && !this.shouldSkipFileName(entry.name)) {
        files.push(entry);
      }
    }

    files.sort((a, b) => String(a.name).localeCompare(String(b.name)));

    for (const f of files) {
      const parts = this.splitFileName(f.name);
      const fileNode: CognitiveNotesFileNode = {
        id: this.generateUuid(),
        name: parts.name,
        extension: parts.extension,
        purpose: "",
        type: "file_A",
        level: 1,
        path: f.name,
        created_on: now,
        updated_on: now,
        last_viewed_on: now,
        views: 0,
        related_nodes: [],
        sort_index: null,
      };
      nodes.push(fileNode);
    }

    return nodes;
  }

  private async scanDirPathFiles(
    dirPath: string,
    rootNotifications: string[],
    now: string
  ): Promise<CognitiveNotesFileNode[]> {
    const { readDir } = await import("@tauri-apps/plugin-fs");
    const entries = await readDir(dirPath);
    const files = entries.filter(
      (e: any) =>
        e?.isFile && !e?.isSymlink && !this.shouldSkipFileName(String(e?.name ?? ""))
    );
    const dirs = entries.filter((e: any) => e?.isDirectory && !e?.isSymlink);

    for (const d of dirs) {
      rootNotifications.push(`Subfolder ignored at ${d.name}`);
    }

    files.sort((a: any, b: any) => String(a.name).localeCompare(String(b.name)));
    return files.map((f: any) => {
      const parts = this.splitFileName(f.name);
      return {
        id: this.generateUuid(),
        name: parts.name,
        extension: parts.extension,
        purpose: "",
        type: "file_A",
        level: 1,
        path: this.joinPath(dirPath, f.name),
        created_on: now,
        updated_on: now,
        last_viewed_on: now,
        views: 0,
        related_nodes: [],
        sort_index: null,
      };
    });
  }

  private async readCognitiveNotesJsonByName(
    dirHandle: FileSystemDirectoryHandle,
    fileName: string
  ): Promise<CognitiveNotesJson | null> {
    try {
      const fileHandle = await dirHandle.getFileHandle(fileName, { create: false });
      const file = await fileHandle.getFile();
      const text = await file.text();
      const parsed = JSON.parse(text);
      return this.parseCognitiveNotesJsonV1(parsed);
    } catch (err) {
      if (err instanceof DOMException && err.name === "NotFoundError") return null;
      return null;
    }
  }

  private async readCognitiveNotesJsonFromPathByName(
    dirPath: string,
    fileName: string
  ): Promise<CognitiveNotesJson | null> {
    try {
      const { exists, readTextFile } = await import("@tauri-apps/plugin-fs");
      const filePath = this.joinPath(dirPath, fileName);
      if (!(await exists(filePath))) return null;
      const text = await readTextFile(filePath);
      const parsed = JSON.parse(text);
      return this.parseCognitiveNotesJsonV1(parsed);
    } catch {
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
      if (entry.name.endsWith(CognitiveNotesManager.FILE_SUFFIX)) {
        names.push(entry.name);
      }
    }
    names.sort((a, b) => a.localeCompare(b));
    return names;
  }

  private async findIndexFileCandidatesFromPath(dirPath: string): Promise<string[]> {
    try {
      const { readDir } = await import("@tauri-apps/plugin-fs");
      const entries = await readDir(dirPath);
      const names = entries
        .filter((e: any) => e?.isFile && typeof e.name === "string")
        .map((e: any) => e.name)
        .filter((name: string) => name.endsWith(CognitiveNotesManager.FILE_SUFFIX));
      names.sort((a, b) => a.localeCompare(b));
      return names;
    } catch {
      return [];
    }
  }

  private async writeCognitiveNotesJsonToFileName(
    dirHandle: FileSystemDirectoryHandle,
    root: CognitiveNotesJson,
    fileName: string
  ): Promise<void> {
    const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(root, null, 2));
    await writable.close();
  }

  private async writeCognitiveNotesJsonFromPathAtomic(
    dirPath: string,
    root: CognitiveNotesJson,
    fileName?: string
  ): Promise<void> {
    const { writeTextFile, rename, remove } = await import("@tauri-apps/plugin-fs");
    const safeName = fileName ?? this.getIndexFileNameFromPath(dirPath);
    const finalPath = this.joinPath(dirPath, safeName);
    const tmpPath = this.joinPath(dirPath, `${safeName}.tmp`);
    const payload = JSON.stringify(root, null, 2);
    await writeTextFile(tmpPath, payload, { create: true });
    try {
      await rename(tmpPath, finalPath);
    } catch {
      await writeTextFile(finalPath, payload, { create: true });
      try {
        await remove(tmpPath);
      } catch {
        // ignore
      }
    }
  }

  async pickRootDirectory(): Promise<FileSystemDirectoryHandle | string | null> {
    if (this.isTauri()) {
      try {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const selected = await open({ directory: true, multiple: false });
        return typeof selected === "string" ? selected : null;
      } catch {
        return null;
      }
    }

    const showDirectoryPicker = (window as any).showDirectoryPicker as
      | (() => Promise<FileSystemDirectoryHandle>)
      | undefined;
    if (!showDirectoryPicker) return null;

    try {
      return await showDirectoryPicker();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return null;
      return null;
    }
  }

  private async ensureMarkerFilesFromHandle(
    dirHandle: FileSystemDirectoryHandle,
    rootName: string
  ): Promise<void> {
    const startFile = this.buildMarkerFileName("start", rootName);
    const endFile = this.buildMarkerFileName("end", rootName);
    for (const fileName of [startFile, endFile]) {
      try {
        await dirHandle.getFileHandle(fileName, { create: false });
        continue;
      } catch (err) {
        if (err instanceof DOMException && err.name !== "NotFoundError") {
          throw err;
        }
      }
      const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
      const writable = await (fileHandle as any).createWritable?.();
      if (writable) {
        await writable.write("");
        await writable.close();
      }
    }
  }

  private async ensureMarkerFilesFromPath(dirPath: string, rootName: string): Promise<void> {
    const startFile = this.buildMarkerFileName("start", rootName);
    const endFile = this.buildMarkerFileName("end", rootName);
    const { exists, writeTextFile } = await import("@tauri-apps/plugin-fs");
    for (const fileName of [startFile, endFile]) {
      const filePath = this.joinPath(dirPath, fileName);
      if (await exists(filePath)) continue;
      await writeTextFile(filePath, "", { create: true });
    }
  }

  async readCognitiveNotesJson(
    dirHandle: FileSystemDirectoryHandle
  ): Promise<CognitiveNotesJson | null> {
    const fileName = this.getIndexFileNameFromHandle(dirHandle);
    const current = await this.readCognitiveNotesJsonByName(dirHandle, fileName);
    if (current) return current;

    const candidates = await this.findIndexFileCandidatesFromHandle(dirHandle);
    for (const candidate of candidates) {
      if (candidate === fileName) continue;
      const parsed = await this.readCognitiveNotesJsonByName(dirHandle, candidate);
      if (!parsed) continue;
      await this.writeCognitiveNotesJsonToFileName(dirHandle, parsed, fileName);
      try {
        await dirHandle.removeEntry(candidate);
      } catch {
        // Silent by design.
      }
      return parsed;
    }

    return null;
  }

  async readCognitiveNotesJsonFromPath(
    dirPath: string
  ): Promise<CognitiveNotesJson | null> {
    const fileName = this.getIndexFileNameFromPath(dirPath);
    const current = await this.readCognitiveNotesJsonFromPathByName(dirPath, fileName);
    if (current) return current;

    const candidates = await this.findIndexFileCandidatesFromPath(dirPath);
    for (const candidate of candidates) {
      if (candidate === fileName) continue;
      const parsed = await this.readCognitiveNotesJsonFromPathByName(dirPath, candidate);
      if (!parsed) continue;
      try {
        const { rename } = await import("@tauri-apps/plugin-fs");
        const oldPath = this.joinPath(dirPath, candidate);
        const nextPath = this.joinPath(dirPath, fileName);
        await rename(oldPath, nextPath);
      } catch {
        await this.writeCognitiveNotesJsonFromPathAtomic(dirPath, parsed, fileName);
      }
      return parsed;
    }

    return null;
  }

  async writeCognitiveNotesJson(
    dirHandle: FileSystemDirectoryHandle,
    root: CognitiveNotesJson
  ): Promise<void> {
    const now = this.nowIso();
    const existing = await this.readCognitiveNotesJson(dirHandle);

    const created_on =
      (root.created_on && typeof root.created_on === "string" && root.created_on) ||
      existing?.created_on ||
      now;
    const last_viewed_on =
      (root.last_viewed_on && typeof root.last_viewed_on === "string" && root.last_viewed_on) ||
      existing?.last_viewed_on ||
      created_on;

    const normalized: CognitiveNotesJson = {
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
      child: Array.isArray(root.child)
        ? (root.child as CognitiveNotesFileNode[])
        : existing?.child ?? [],
    };

    const fileName = this.getIndexFileNameFromHandle(dirHandle);
    await this.writeCognitiveNotesJsonToFileName(dirHandle, normalized, fileName);
  }

  async writeCognitiveNotesJsonFromPath(
    dirPath: string,
    root: CognitiveNotesJson
  ): Promise<void> {
    if (!dirPath || typeof dirPath !== "string" || dirPath.trim() === "") {
      console.error(
        "[CognitiveNotesManager] writeCognitiveNotesJsonFromPath: dirPath is empty or invalid",
        dirPath
      );
      throw new Error("Directory path is required for saving cognitive notes json");
    }

    const now = this.nowIso();
    const existing = await this.readCognitiveNotesJsonFromPath(dirPath);
    const created_on =
      (root.created_on && typeof root.created_on === "string" && root.created_on) ||
      existing?.created_on ||
      now;
    const last_viewed_on =
      (root.last_viewed_on && typeof root.last_viewed_on === "string" && root.last_viewed_on) ||
      existing?.last_viewed_on ||
      created_on;

    const normalized: CognitiveNotesJson = {
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
      child: Array.isArray(root.child)
        ? (root.child as CognitiveNotesFileNode[])
        : existing?.child ?? [],
    };

    const fileName = this.getIndexFileNameFromPath(dirPath);
    await this.writeCognitiveNotesJsonFromPathAtomic(dirPath, normalized, fileName);
  }

  async initializeIndexFromHandle(
    dirHandle: FileSystemDirectoryHandle
  ): Promise<CognitiveNotesJson> {
    const now = this.nowIso();
    const root = this.buildNewRootJson({ name: dirHandle.name, path: "", now });
    root.child = await this.scanDirectoryHandleFiles(
      dirHandle,
      root.notifications,
      now
    );
    await this.writeCognitiveNotesJson(dirHandle, root);
    return root;
  }

  async initializeIndexFromPath(rootPath: string): Promise<CognitiveNotesJson> {
    const now = this.nowIso();
    const rootName = this.baseNameFromPath(rootPath);
    const root = this.buildNewRootJson({ name: rootName, path: rootPath, now });
    try {
      root.child = await this.scanDirPathFiles(
        rootPath,
        root.notifications,
        now
      );
    } catch (err) {
      root.error_messages.push(`Failed to scan root folder: ${String(err)}`);
      root.child = [];
    }
    await this.writeCognitiveNotesJsonFromPathAtomic(
      rootPath,
      root,
      this.getIndexFileName(rootName)
    );
    return root;
  }

  async loadOrCreateCognitiveNotesJson(
    dirHandle: FileSystemDirectoryHandle
  ): Promise<{ root: CognitiveNotesJson; created: boolean }> {
    const existing = await this.readCognitiveNotesJson(dirHandle);
    if (existing) {
      const updated = await this.syncCognitiveNotesJsonFromHandle(dirHandle, existing);
      return { root: updated, created: false };
    }
    const createdRoot = await this.initializeIndexFromHandle(dirHandle);
    await this.ensureMarkerFilesFromHandle(dirHandle, createdRoot.name);
    return { root: createdRoot, created: true };
  }

  async loadOrCreateCognitiveNotesJsonFromPath(
    dirPath: string
  ): Promise<{ root: CognitiveNotesJson; created: boolean }> {
    if (!dirPath || typeof dirPath !== "string" || dirPath.trim() === "") {
      throw new Error("Directory path is required for loading cognitive notes json");
    }
    const existing = await this.readCognitiveNotesJsonFromPath(dirPath);
    if (existing) {
      const updated = await this.syncCognitiveNotesJsonFromPath(dirPath, existing);
      return { root: updated, created: false };
    }
    const createdRoot = await this.initializeIndexFromPath(dirPath);
    await this.ensureMarkerFilesFromPath(dirPath, createdRoot.name);
    return { root: createdRoot, created: true };
  }

  async syncCognitiveNotesJsonFromHandle(
    dirHandle: FileSystemDirectoryHandle,
    existing: CognitiveNotesJson
  ): Promise<CognitiveNotesJson> {
    const now = this.nowIso();
    const rootName = dirHandle.name;
    const notifications = Array.isArray(existing.notifications)
      ? [...existing.notifications]
      : [];

    try {
      const scannedNodes = await this.scanDirectoryHandleFiles(
        dirHandle,
        notifications,
        now
      );
      const merged = this.mergeRootWithScan({
        existing,
        scannedNodes,
        rootName,
        rootPath: "",
        notifications,
        now,
      });
      await this.writeCognitiveNotesJson(dirHandle, merged);
      return merged;
    } catch (err) {
      const nextErrors = Array.isArray(existing.error_messages)
        ? [...existing.error_messages]
        : [];
      nextErrors.push(`Failed to sync root folder: ${String(err)}`);
      return { ...existing, error_messages: nextErrors };
    }
  }

  async syncCognitiveNotesJsonFromPath(
    dirPath: string,
    existing: CognitiveNotesJson
  ): Promise<CognitiveNotesJson> {
    const now = this.nowIso();
    const rootName = this.baseNameFromPath(dirPath);
    const notifications = Array.isArray(existing.notifications)
      ? [...existing.notifications]
      : [];

    try {
      const scannedNodes = await this.scanDirPathFiles(
        dirPath,
        notifications,
        now
      );
      const merged = this.mergeRootWithScan({
        existing,
        scannedNodes,
        rootName,
        rootPath: dirPath,
        notifications,
        now,
      });
      await this.writeCognitiveNotesJsonFromPathAtomic(
        dirPath,
        merged,
        this.getIndexFileName(rootName)
      );
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

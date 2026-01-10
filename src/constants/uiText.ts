/**
 * uiText.ts
 * 
 * Centralized file for all user-facing text in the application.
 * This includes labels, button names, tooltips, hover messages, alerts,
 * confirmations, status messages, empty states, and panel titles.
 * 
 * All components must import text from this file instead of hard-coding strings.
 * 
 * Structure:
 * - panels: Panel titles and labels
 * - buttons: Button labels
 * - tooltips: Hover messages and tooltips
 * - alerts: Alert and confirmation messages
 * - statusMessages: Status texts (saving, saved, etc.)
 * - emptyStates: Empty state messages
 * - ariaLabels: Accessibility labels
 * - contextMenus: Context menu item labels
 */

export const uiText = {
  /**
   * Panel titles and labels
   */
  panels: {
    files: 'Files',
    node: 'Node',
    settings: 'Settings',
    mindMap: 'Mind Map',
    folderTree: 'Folder Tree',
  },

  /**
   * Form field labels (keep user-facing text centralized here)
   */
  fields: {
    nodeDetails: {
      name: 'Name',
      title: 'Title',
      description: 'Description',
      createdTime: 'Created',
      updatedTime: 'Updated',
    },
  },

  /**
   * Button labels
   */
  buttons: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    create: 'Create',
    edit: 'Edit',
    rename: 'Rename',
    duplicate: 'Duplicate',
    export: 'Export',
    import: 'Import',
    newFile: 'New File',
    newFolder: 'New Folder',
    close: 'Close',
    apply: 'Apply',
    reset: 'Reset',
    reload: 'Reload',
    refresh: 'Refresh',
    expand: 'Expand',
    collapse: 'Collapse',
    zoomIn: 'Zoom In',
    zoomOut: 'Zoom Out',
    fitView: 'Fit View',
    undo: 'Undo',
    redo: 'Redo',
    cut: 'Cut',
    copy: 'Copy',
    paste: 'Paste',
    selectAll: 'Select All',
    clearSelection: 'Clear Selection',
  },

  /**
   * Tooltips and hover messages
   */
  tooltips: {
    resizeLeftSidebar: 'Resize left sidebar',
    resizeRightSidebar: 'Resize right sidebar',
    toggleLeftPanel: 'Toggle left panel',
    toggleRightPanel: 'Toggle right panel',
    toggleSettings: 'Toggle settings',
    saveFile: 'Save file',
    deleteFile: 'Delete file',
    createFile: 'Create new file',
    createFolder: 'Create new folder',
    renameItem: 'Rename item',
    duplicateItem: 'Duplicate item',
    exportData: 'Export data',
    importData: 'Import data',
    zoomIn: 'Zoom in',
    zoomOut: 'Zoom out',
    fitView: 'Fit view to canvas',
    undo: 'Undo last action',
    redo: 'Redo last action',
    cut: 'Cut selection',
    copy: 'Copy selection',
    paste: 'Paste',
    selectAll: 'Select all nodes',
    clearSelection: 'Clear selection',
    selectRootFolder: 'Select root folder',
    changeRootFolder: 'Change root folder',
    rootFolderNamePrefix: 'Root Folder:',
  },

  /**
   * Alert and confirmation messages
   */
  alerts: {
    confirmDelete: 'Are you sure you want to delete this item?',
    confirmDeleteFile: 'Are you sure you want to delete this file?',
    confirmDeleteFolder: 'Are you sure you want to delete this folder? This will also delete all contents.',
    confirmUnsavedChanges: 'You have unsaved changes. Are you sure you want to leave?',
    confirmReset: 'Are you sure you want to reset all changes?',
    errorSaveFailed: 'Failed to save. Please try again.',
    errorLoadFailed: 'Failed to load. Please try again.',
    errorDeleteFailed: 'Failed to delete. Please try again.',
    errorCreateFailed: 'Failed to create. Please try again.',
    errorInvalidName: 'Invalid name. Please use a different name.',
    errorNameExists: 'A file or folder with this name already exists.',
    errorNetworkError: 'Network error. Please check your connection.',
    successSaved: 'Changes saved successfully.',
    successDeleted: 'Item deleted successfully.',
    successCreated: 'Item created successfully.',
    confirmReplaceRootFolder: 'Replace the current root folder?',
  },

  /**
   * Status messages
   */
  statusMessages: {
    saving: 'Saving...',
    saved: 'Saved',
    loading: 'Loading...',
    processing: 'Processing...',
    exporting: 'Exporting...',
    importing: 'Importing...',
    connecting: 'Connecting...',
    connected: 'Connected',
    disconnected: 'Disconnected',
    syncing: 'Syncing...',
    synced: 'Synced',
    idle: 'Ready',
  },

  /**
   * Empty state messages
   */
  emptyStates: {
    noNodes: 'No nodes yet. Create your first node to get started.',
    noFiles: 'No files yet. Create your first file to get started.',
    noFolders: 'No folders yet. Create your first folder to get started.',
    noSelection: 'Select a node to see details here.',
    noSearchResults: 'No results found. Try a different search term.',
    emptyFolder: 'This folder is empty.',
    emptyMindMap: 'Your mind map is empty. Start by creating a node.',
    noHistory: 'No history available.',
  },

  /**
   * Accessibility labels (aria-label)
   */
  ariaLabels: {
    workspace: 'ParallelMind workspace',
    leftSidebar: 'Left sidebar',
    rightSidebar: 'Right sidebar',
    mindMapCanvas: 'Mind map canvas',
    folderTree: 'Folder tree',
    nodeEditor: 'Node editor',
    settingsPanel: 'Settings panel',
    toolbar: 'Toolbar',
    contextMenu: 'Context menu',
  },

  /**
   * Context menu item labels
   */
  contextMenus: {
    node: {
      edit: 'Edit',
      delete: 'Delete',
      duplicate: 'Duplicate',
      rename: 'Rename',
      copy: 'Copy',
      cut: 'Cut',
      paste: 'Paste',
      export: 'Export',
      properties: 'Properties',
    },
    folder: {
      openFolder: 'Open Folder',
      newFile: 'New File',
      newFolder: 'New Folder',
      rename: 'Rename',
      delete: 'Delete',
      expand: 'Expand All',
      collapse: 'Collapse All',
      export: 'Export Folder',
    },
    canvas: {
      paste: 'Paste',
      selectAll: 'Select All',
      clearSelection: 'Clear Selection',
      fitView: 'Fit View',
      zoomIn: 'Zoom In',
      zoomOut: 'Zoom Out',
    },
  },

  /**
   * Placeholder text
   */
  placeholders: {
    nodeDetails: 'Select a node to see details / editor here (placeholder).',
    folderTreePlaceholder: '(placeholder) Hook this up to fileManager + root-folder.json later.',
    search: 'Search files and folders...',
    fileName: 'Enter file name',
    folderName: 'Enter folder name',
    nodeName: 'Enter node name',
    nodeContent: 'Enter node content...',
    nodeTitle: 'Enter title',
    nodeDescription: 'Enter description',
    settingsContainer: 'Settings Container',
  },
} as const;

/**
 * Type-safe access to UI text
 */
export type UIText = typeof uiText;
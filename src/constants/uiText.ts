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
    edge: 'Edge',
    settings: 'Settings',
    mindMap: 'Mind Map',
    folderTree: 'Folder Tree',
    nodeSelector: 'Node Selector',
    notesFeed: 'Notes Feed',
  },
  leftPanel: {
    viewLabel: 'View',
    views: {
      bookmarks: 'Bookmarks',
      fileTree: 'File Tree',
    },
    emptyBookmarks: 'No bookmarks yet.',
  },
  flowchartNodes: {
    roundRect: {
      name: 'Rounded Rectangle',
      purpose: 'Start or end of a flow.',
    },
    rect: {
      name: 'Rectangle',
      purpose: 'Process or action step.',
    },
    triangle: {
      name: 'Triangle',
      purpose: 'Directional or merge indicator.',
    },
    decision: {
      name: 'Decision',
      purpose: 'Branching decision point.',
    },
    circle: {
      name: 'Circle',
      purpose: 'Connector or pause point.',
    },
    parallelogram: {
      name: 'Parallelogram',
      purpose: 'Input or output.',
    },
    youtube: {
      name: 'YouTube Player',
      purpose: 'Embed a YouTube video with controls.',
    },
  },
  nodeSelector: {
    intro: "Select a node type to add to the canvas.",
    flowchartTitle: "Flowchart nodes",
    flowchartDescription: "Flowchart nodes can be added to the canvas from here.",
    fileTitle: "File nodes",
    fileDescription: "File nodes are created under the selected folder (or root).",
    items: {
      shieldFile: {
        name: "Input File Node",
        purpose: "Shield-styled file node with Name and Purpose.",
      },
      outputFile: {
        name: "Output File Node",
        purpose: "Inverted shield-styled file node with Name and Purpose.",
      },
    },
  },
  settings: {
    appearance: {
      edgeTypeLabel: 'Edge type',
      edgeTypeDesc: 'Choose how connections between nodes are drawn.',
      edgeTypeOptions: {
        bezier: 'Bezier',
        straight: 'Straight',
        simpleBezier: 'Simple Bezier',
        step: 'Step',
        smoothstep: 'Smoothstep',
      },
    },
    fileManager: {
      sectionTitle: "File Manager",
      fileSearch: {
        sectionTitle: "File Search",
        recentLimitLabel: "Recent items limit",
        recentLimitDesc: "Maximum number of items shown under Recent.",
      },
    },
    storage: {
      appDataFolderLabel: 'App data folder',
      appDataFolderDesc:
        'Used for bookmarks, reminders, and other app-managed files.',
      notSet: 'Not set',
      chooseFolder: 'Choose folder',
      clear: 'Clear',
    },
    bookmarks: {
      sectionTitle: 'Bookmarks',
      sectionDesc: 'Sorting preferences for bookmarks.',
      sortOrderLabel: 'Sorting order',
      sortOrderDesc: 'Choose how bookmarks are ordered.',
      sortOrders: {
        viewsDesc: 'Most viewed',
        viewsAsc: 'Least viewed',
      },
    },
  },

  /**
   * Menu labels
   */
  menus: {
    file: 'File',
    configRootFolder: 'Cognitive File Explorer',
    openCognitiveNotes: 'Open Cognitive Notes',
  },

  /**
   * Tabs
   */
  tabs: {
    untitled: 'Untitled',
    closeTab: 'Close tab',
  },

  /**
   * Form field labels (keep user-facing text centralized here)
   */
  fields: {
    nodeDetails: {
      name: 'Name',
      caption: 'Caption',
      purpose: 'Purpose',
      sortOrder: 'Sort order',
      sectionTitle: 'File details',
      associatedTextFileQuestion: 'Do you want to create associated textfile?',
      associatedTextFileCreate: 'Yes, create',
      associatedTextFileSkip: 'No',
      associatedTextFileLabel: 'Associated text file',
      associatedTextFileCreated: 'Associated file created.',
      associatedTextFileSkipped: 'Associated file not created.',
      decisionStatement: 'If & Else Statement',
      decisionDetailsLabel: 'Details',
      createdTime: 'Created',
      updatedTime: 'Updated',
      youtubeLink: 'YouTube link',
      youtubeSettings: 'Player settings',
      youtubeStart: 'Start (sec)',
      youtubeEnd: 'End (sec)',
      youtubeLoop: 'Loop',
      youtubeMute: 'Mute',
      youtubeControls: 'Controls',
    },
    edgeDetails: {
      purpose: 'Purpose',
      sectionTitle: 'Edge details',
    },
  },
  smartPad: {
    previewToggleShow: 'Show markdown preview',
    previewToggleCode: 'Show markdown code',
  },
  appFooter: {
    desktopMode: 'Desktop mode',
    browserMode: 'Browser mode',
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
    on: 'On',
    off: 'Off',
    paste: 'Paste',
    selectAll: 'Select All',
    clearSelection: 'Clear Selection',
  },

  /**
   * Canvas display options
   */
  canvas: {
    displayMode: {
      details: 'Details',
    },
    displayModeTooltips: {
      details: 'Show node details',
    },
    viewMenu: {
      showAllNodes: 'Show all nodes',
      gridView: 'Grid view',
      resetLayout: 'Reset layout',
      resetNodeSizes: 'Reset node sizes',
      collapseAllNodes: 'Collapse all nodes',
      expandAllNodes: 'Expand all nodes',
    },
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
    lockNodePositions: 'Lock node positions',
    unlockNodePositions: 'Unlock node positions',
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
    autoCenterSelection: 'Auto-center selected node',
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
    /**
     * Node creation validation (mind map).
     * Kept in `alerts` to avoid introducing a new top-level section for a small,
     * user-facing validation surface.
     */
    nodeNameRequired: 'Name is required to create this item.',
    nodeNameInvalidFileName:
      'Name must follow file naming rules (no reserved characters, no trailing dot/space).',
    nodeNameConflictAtLevel: 'An item with this name already exists at this level.',
    errorNetworkError: 'Network error. Please check your connection.',
    successSaved: 'Changes saved successfully.',
    successDeleted: 'Item deleted successfully.',
    successCreated: 'Item created successfully.',
    confirmReplaceRootFolder: 'Replace the current root folder?',
    fileSearchUnavailable:
      'File Search is unavailable because no workspace or tab is currently active.',
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
    layoutSaving: 'Saving layout...',
    layoutSaved: 'Layout saved',
    layoutSaveFailed: 'Layout save failed',
    saveFailed: 'Save failed',
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
    canvasTabs: 'Canvas tabs',
  },

  /**
   * Context menu item labels
   */
  contextMenus: {
    tabs: {
      bookmark: 'Bookmark',
    },
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
      showParentPath: 'Show Parent path',
      hideParentPath: 'Hide Parent path',
      showChildren: 'Show children',
      hideChildren: 'Hide children',
      moveNode: 'Move node',
      moveWithChildren: 'Move with children',
      showSubtreeNotes: 'Show subtree notes',
    },
    folder: {
      openFolder: 'Open Folder',
      openInNewTab: 'Open in New Tab',
      moveFolderTree: 'Move this folder tree',
      moveOnlyFolder: 'Move only this folder',
      closeTree: 'Close tree',
      openTree: 'Open tree',
      newFile: 'New File',
      newFolder: 'New Folder',
      rename: 'Rename',
      delete: 'Delete',
      expand: 'Expand All',
      collapse: 'Collapse All',
      export: 'Export Folder',
    },
    file: {
      openFile: 'Open File',
    },
    canvas: {
      paste: 'Paste',
      selectAll: 'Select All',
      clearSelection: 'Clear Selection',
      nodeSelector: 'Node Selector',
      nodeDetails: 'Node Details',
      newFile: 'New File',
      newFolder: 'New Folder',
      newPolaroidImage: 'Image',
      newFullImage: 'Full Image',
      newDecision: 'Decision',
      fitView: 'Fit View',
      zoomIn: 'Zoom In',
      zoomOut: 'Zoom Out',
    },
  },

  /**
   * Placeholder text
   */
  placeholders: {
    search: 'Search files and folders...',
    fileName: 'Enter file name',
    folderName: 'Enter folder name',
    nodeName: 'Enter node name',
    nodeContent: 'Enter node content...',
    nodePurpose: 'Enter purpose',
    nodeDecisionDetails: 'Enter details',
    youtubeLink: 'Paste YouTube URL or video ID',
    fileContentEmpty: 'No content to display.',
    fileContentUnavailable: 'Unable to load file content.',
    fileContentNotText: 'This file is not text-based. Please open it in the file editor. Right-click on file and select "Open File".',
    settingsContainer: 'Settings Container',
  },
} as const;

/**
 * Type-safe access to UI text
 */
export type UIText = typeof uiText;
# ParallelMind Frontend

A production-ready React + TypeScript mind mapping application built with Vite.

## Project Structure

```
parallelmind_frontend/
├── src/
│   ├── assets/                      # Static files, icons, images
│   │   ├── icons/                  # SVG icon components for nodes
│   │   └── images/                 # Image assets
│   │
│   ├── components/                 # Reusable UI components
│   │   ├── NodeIcons/              # SVG icon components for nodes
│   │   ├── Toolbars/               # Toolbar components
│   │   ├── Panels/                 # Panel components
│   │   ├── TreeView/               # Folder structure (left panel) component
│   │   └── Editor/                 # Text editor components
│   │
│   ├── containers/                 # Main layout containers
│   │   ├── MindMap/                # Main visual map using ReactFlow
│   │   ├── LeftPanel/              # Folder Tree (left panel)
│   │   ├── RightPanel/             # Node detail & editor view
│   │   └── Settings/               # Theme, font, LLM model, and appearance options
│   │
│   ├── data/                       # JSON file handling and helpers
│   │   ├── root-folder.json        # Central JSON file tracking all nodes, folders, files
│   │   └── fileManager.ts          # Logic for create, read, update, delete (CRUD) operations
│   │
│   ├── hooks/                      # Custom React hooks
│   │   └── useAutoSave.ts          # Hook for 3-second delayed auto-save of text files
│   │
│   ├── lib/                        # LLM integration (Chrome, OpenAI, Gemini)
│   │   ├── llmProvider.ts          # Handles connection to Chrome LLM, OpenAI, or Gemini
│   │   └── markdownPreview.ts      # Converts text to Markdown format using LLM
│   │
│   ├── store/                      # State management (Zustand, Redux, etc.)
│   │   └── mindMapStore.ts         # Centralized app state (node selection, settings, etc.)
│   │
│   ├── styles/                     # Global and component styles
│   │   └── theme.css               # Theme variables and global styles
│   │
│   ├── types/                      # TypeScript interfaces & types
│   │   └── nodeTypes.ts            # Types for nodes, edges, folder levels, etc.
│   │
│   ├── utils/                      # Utility functions
│   │   ├── jsonUtils.ts            # JSON parsing and stringification utilities
│   │   └── colorUtils.ts           # Generates folder/file color schemes per level
│   │
│   ├── App.tsx                     # Main application component
│   ├── main.tsx                    # Application entry point
│   └── index.css                   # Global CSS styles
│
├── public/                         # Public assets
│   ├── react.svg
│   └── vite.svg
├── index.html                      # HTML entry point
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## Key Files & Directories

### Data Management

- **`src/data/root-folder.json`** - Central JSON file tracking all nodes, folders, and files. This is the master structure file that maintains the hierarchical organization of the entire mind map.

- **`src/data/fileManager.ts`** - Logic for create, read, update, delete (CRUD) operations. Handles all file system operations including creating, reading, updating, and deleting files/folders, plus synchronizing changes with root-folder.json.

### LLM Integration

- **`src/lib/llmProvider.ts`** - Handles connection to Chrome LLM, OpenAI, or Gemini. Provides a unified interface for interacting with different LLM providers, allowing users to switch between providers seamlessly.

- **`src/lib/markdownPreview.ts`** - Converts text to Markdown format using LLM. Provides utilities for generating and rendering Markdown content, leveraging the LLM provider to enhance and format text content.

### Components & Containers

- **`src/components/NodeIcons/`** - SVG icon components for nodes. Reusable icon components that can be used throughout the application to represent different node types.

- **`src/components/TreeView/`** - Folder structure (left panel) component. Displays the hierarchical folder structure in a tree view format.

- **`src/containers/MindMap/`** - Main visual map using ReactFlow. The central visualization component that renders the mind map with nodes and edges.

- **`src/containers/RightPanel/`** - Node detail & editor view. Displays detailed information about the selected node and provides editing capabilities.

- **`src/containers/Settings/`** - Theme, font, LLM model, and appearance options. Configuration panel for customizing the application's appearance and behavior.

### State & Types

- **`src/store/mindMapStore.ts`** - Centralized app state (node selection, settings, etc.). Manages global application state including nodes, edges, selected items, and application settings.

- **`src/types/nodeTypes.ts`** - Types for nodes, edges, folder levels, etc. Centralized TypeScript type definitions ensuring type safety across the application.

### Utilities & Hooks

- **`src/hooks/useAutoSave.ts`** - Hook for 3-second delayed auto-save of text files. Automatically saves content after a delay when changes are detected, preventing excessive save operations.

- **`src/utils/colorUtils.ts`** - Generates folder/file color schemes per level. Provides utilities for creating consistent color palettes based on the hierarchical depth of folders and files.

## Getting Started

### Install Dependencies

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Technologies

- **React 19** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **ReactFlow** - Node-based diagrams
- **Radix UI** - Accessible components
- **React Icons** - Icon library

## Features

- Mind map visualization with ReactFlow
- File/folder management
- LLM integration (OpenAI, Gemini, Chrome)
- Auto-save functionality
- Context menus
- Markdown support

# Cognitive Notes Extension

This folder contains the Cognitive Notes extension for Parallelmind.

Planned structure:
- `entry.ts`: module entry and File > Open handler
- `components/`: extension-specific UI pieces (uses existing canvas/nodes/panels)
- `containers/`: extension-specific layouts and workflows
- `data/`: cognitive notes index helpers and file logic
- `types/`: extension-specific types

The extension reuses existing canvas, nodes, panels, and SmartPad when the
workflows are wired in.

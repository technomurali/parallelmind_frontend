import { uiText } from '../../constants/uiText';

export type TreeViewProps = {
  className?: string;
};

// Placeholder TreeView (Folder Tree) – actual file/folder behavior will be added later.
export function TreeView({ className }: TreeViewProps) {
  return (
    <div className={`pm-treeview ${className ?? ''}`} aria-label={uiText.ariaLabels.folderTree}>
      <div className="pm-treeview__title">{uiText.panels.folderTree}</div>
      <div className="pm-treeview__hint">
        {uiText.placeholders.folderTreePlaceholder}
      </div>
    </div>
  );
}


export const insertTextAtSelection = (
  editor: HTMLElement,
  text: string
): void => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    editor.appendChild(document.createTextNode(text));
    return;
  }

  const range = selection.getRangeAt(0);
  range.deleteContents();
  const node = document.createTextNode(text);
  range.insertNode(node);

  range.setStartAfter(node);
  range.collapse(true);
  selection.removeAllRanges();
  selection.addRange(range);
};

export const getEditorPlainText = (editor: HTMLElement): string => {
  return editor.innerText ?? editor.textContent ?? "";
};

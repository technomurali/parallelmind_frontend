export type ExtensionAction = () => Promise<void> | void;

export type ExtensionEntry = {
  id: string;
  actions: Record<string, ExtensionAction>;
};

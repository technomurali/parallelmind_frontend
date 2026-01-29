/// <reference types="vite/client" />

declare module "*.yml?raw" {
  const content: string;
  export default content;
}

declare module "*.yaml?raw" {
  const content: string;
  export default content;
}

declare module "turndown" {
  const TurndownService: any;
  export default TurndownService;
}

declare module "turndown-plugin-gfm" {
  export const gfm: any;
}

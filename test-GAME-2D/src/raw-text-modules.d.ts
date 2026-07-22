export {};

declare global {
  interface ImportMeta {
    glob(pattern: string | string[], options: { query?: string; import?: string; eager: true }): Record<string, unknown>;
  }
}

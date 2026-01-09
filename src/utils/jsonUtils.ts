// JSON utility functions

export function parseJSON<T>(jsonString: string): T | null {
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.error('Failed to parse JSON:', error);
    return null;
  }
}

export function stringifyJSON(obj: unknown, indent: number = 2): string {
  return JSON.stringify(obj, null, indent);
}
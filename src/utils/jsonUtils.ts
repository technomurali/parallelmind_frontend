/**
 * jsonUtils.ts
 * 
 * Utility functions for parsing and stringifying JSON data.
 * Provides safe JSON operations with error handling for the application.
 * Used throughout the codebase for data serialization and deserialization.
 */

/**
 * Safely parses a JSON string into a typed object
 * Returns null if parsing fails instead of throwing an error.
 * 
 * @template T - The expected type of the parsed JSON object
 * @param jsonString - The JSON string to parse
 * @returns Parsed object of type T, or null if parsing fails
 * 
 * @example
 * ```ts
 * const data = parseJSON<{ name: string }>('{"name": "test"}');
 * if (data) {
 *   console.log(data.name); // "test"
 * }
 * ```
 */
export function parseJSON<T>(jsonString: string): T | null {
  try {
    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.error('Failed to parse JSON:', error);
    return null;
  }
}

/**
 * Converts an object to a formatted JSON string
 * Provides consistent indentation for readable output.
 * 
 * @param obj - The object to stringify
 * @param indent - Number of spaces for indentation (default: 2)
 * @returns Formatted JSON string
 * 
 * @example
 * ```ts
 * const json = stringifyJSON({ name: 'test', value: 123 });
 * // Returns: '{\n  "name": "test",\n  "value": 123\n}'
 * ```
 */
export function stringifyJSON(obj: unknown, indent: number = 2): string {
  return JSON.stringify(obj, null, indent);
}
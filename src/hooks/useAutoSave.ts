/**
 * useAutoSave.ts
 * 
 * Hook for 3-second delayed auto-save of text files.
 * Automatically saves content after a specified delay when changes are detected.
 * Prevents excessive save operations while ensuring data persistence.
 * 
 * Default delay: 3000ms (3 seconds)
 */

import { useEffect, useRef } from 'react';

/**
 * useAutoSave hook
 * 
 * Automatically calls the save callback after a delay period.
 * The delay is reset each time the callback changes, ensuring
 * that saves only occur after the user has stopped making changes.
 * 
 * @param callback - Function to call for saving (typically saves file content)
 * @param delay - Delay in milliseconds before auto-saving (default: 3000ms / 3 seconds)
 * 
 * @example
 * ```tsx
 * const saveFile = () => {
 *   fileManager.update(fileId, { content: editorContent });
 * };
 * 
 * useAutoSave(saveFile, 3000);
 * ```
 */
export function useAutoSave(callback: () => void, delay: number = 3000) {
  // Use ref to store the latest callback to avoid stale closures
  const callbackRef = useRef(callback);

  // Update the ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Set up the auto-save interval
  useEffect(() => {
    const interval = setInterval(() => {
      callbackRef.current();
    }, delay);

    // Cleanup: clear interval on unmount or when delay changes
    return () => clearInterval(interval);
  }, [delay]);
}
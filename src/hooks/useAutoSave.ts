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
 * Debounced auto-save: schedules a save after a delay period, and resets the timer
 * whenever any dependency changes. This prevents excessive saves while typing.
 * 
 * @param callback - Function to call for saving (typically persists current state)
 * @param delay - Delay in milliseconds before auto-saving (default: 3000ms / 3 seconds)
 * @param deps - Dependencies that should trigger (and reset) the debounce timer
 * @param enabled - When false, no timer is scheduled
 * 
 * @example
 * ```tsx
 * const saveFile = () => {
 *   fileManager.update(fileId, { content: editorContent });
 * };
 * 
 * useAutoSave(saveFile, 3000, [editorContent], true);
 * ```
 */
export function useAutoSave(
  callback: () => void,
  delay: number = 3000,
  deps: unknown[] = [],
  enabled: boolean = true,
) {
  // Use ref to store the latest callback to avoid stale closures
  const callbackRef = useRef(callback);

  // Update the ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Set up the debounced auto-save timer
  useEffect(() => {
    if (!enabled) return;
    const timeout = window.setTimeout(() => {
      callbackRef.current();
    }, delay);

    // Cleanup: clear timeout on unmount or when any dependency changes (debounce reset)
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delay, enabled, ...deps]);
}
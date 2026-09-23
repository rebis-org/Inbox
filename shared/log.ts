/* eslint-disable no-console */

export function logError(...parts: readonly unknown[]): void {
  console.error(...parts);
}

export function logInfo(...parts: readonly unknown[]): void {
  console.log(...parts);
}

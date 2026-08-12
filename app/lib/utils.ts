import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function requiredId(id: string | null | undefined, name: string): string {
  if (!id) throw new Error(`${name} is required`);
  return id;
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / (k ** i)).toFixed(dm))} ${sizes[i]}`;
}

export function splitEmailList(value?: string | null): string[] {
  const parts = (value || '').split(',');
  const result: string[] = [];
  for (let i = 0, len = parts.length; i < len; i++) {
    const trimmed = parts[i].trim();
    if (trimmed) result.push(trimmed);
  }
  return result;
}

export function toEmailListValue(addresses: string[]): string | string[] | undefined {
  if (addresses.length === 0) return undefined;
  return addresses.length === 1 ? addresses[0] : addresses;
}

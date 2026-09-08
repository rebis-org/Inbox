import { clsx } from 'clsx';
import type { ClassValue } from 'clsx';
import { parseAddressList } from 'email-addresses';
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
  const parsed = parseAddressList(value ?? '');
  const parts = parsed
    ? parsed.flatMap((entry) => (entry.type === 'group'
      ? entry.addresses.map((mailbox) => mailbox.address)
      : [entry.address]))
    : (value ?? '').split(',');
  return parts.reduce<string[]>((acc, part) => {
    const trimmed = part.trim();
    if (trimmed) acc.push(trimmed);
    return acc;
  }, []);
}

export function toEmailListValue(addresses: string[]): string | string[] | undefined {
  if (addresses.length === 0) return undefined;
  return addresses.length === 1 ? addresses[0] : addresses;
}

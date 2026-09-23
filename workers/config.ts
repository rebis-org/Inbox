import type { Env } from './types';

function asParts(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(',');
  return [];
}

function splitList(value: unknown): string[] {
  return asParts(value).reduce<string[]>((out, part) => {
    const trimmed = String(part).trim().toLowerCase();
    if (trimmed) out.push(trimmed);
    return out;
  }, []);
}

export function domains(env: Env) {
  return splitList(env.DOMAINS);
}

export function emailAddresses(env: Env) {
  return splitList(env.EMAIL_ADDRESSES);
}

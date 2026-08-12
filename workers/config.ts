import type { Env } from './types';

export function domains(env: Env) {
  return env.DOMAINS.split(',').reduce((out: string[], part) => {
    const trimmed = part.trim();
    if (trimmed) out.push(trimmed);
    return out;
  }, []);
}

export function emailAddresses(env: Env) {
  return env.EMAIL_ADDRESSES as string[];
}

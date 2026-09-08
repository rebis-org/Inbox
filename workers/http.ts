import { err, ok, result } from '@moeru/results';
import type { Result } from '@moeru/results';
import { tryCatchAsync } from '@moeru/std/try-catch';
import * as v from 'valibot';

export function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export function text(body: string, status = 200) {
  return new Response(body, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}

export const noContent = () => new Response(null, { status: 204 });

export function apiError(status: number, message: string) {
  return json({ error: message }, status);
}

export async function parseJsonBody<T extends v.GenericSchema>(
  request: Request,
  schema: T
): Promise<Result<v.InferOutput<T>, Response>> {
  const parsedBody = await tryCatchAsync(() => request.json());
  const body = parsedBody.error === undefined ? parsedBody.data : undefined;
  const parsed = v.safeParse(schema, body);
  if (!parsed.success) {
    return err(apiError(400, 'Invalid request body'));
  }
  return ok(parsed.output);
}

export function intParam(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isNaN(n) ? undefined : n;
}

export function boolParam(value: string | null): boolean | undefined {
  if (value === null || value === '') return undefined;
  return value === 'true' || value === '1';
}

export function decodeParams<P extends Record<string, string>>(
  params: Record<string, string> | undefined
): P {
  return Object.entries(params ?? {}).reduce<Record<string, string>>((acc, [key, value]) => {
    acc[key] = decodeURIComponent(value);
    return acc;
  }, {}) as P;
}

export async function withBody<T extends v.GenericSchema>(
  request: Request,
  schema: T,
  fn: (value: v.InferOutput<T>) => Response | Promise<Response>
): Promise<Response> {
  return result.match(await parseJsonBody(request, schema), fn, (response) => response);
}

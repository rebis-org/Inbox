import { err, ok } from '@moeru/results';
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

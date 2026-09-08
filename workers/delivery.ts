export interface ResendMapping {
  mailboxId: string,
  emailId: string
}

const key = (resendId: string) => `resend-ids/${resendId}.json`;

export function storeResendMapping(bucket: R2Bucket, resendId: string, mapping: ResendMapping) {
  return bucket.put(key(resendId), JSON.stringify(mapping));
}

export async function getResendMapping(
  bucket: R2Bucket,
  resendId: string
): Promise<ResendMapping | null> {
  const obj = await bucket.get(key(resendId));
  if (!obj) return null;
  try {
    return JSON.parse(await obj.text()) as ResendMapping;
  } catch {
    return null;
  }
}

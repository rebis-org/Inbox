export const mailboxKey = (email: string) => `mailboxes/${email}.json`;

export async function listMailboxes(bucket: R2Bucket): Promise<string[]> {
  const list = await bucket.list({ prefix: 'mailboxes/' });
  return list.objects.map((obj) => obj.key.replace('mailboxes/', '').replace('.json', ''));
}

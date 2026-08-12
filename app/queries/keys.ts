export const queryKeys = {
  mailboxes: {
    all: ['mailboxes'] as const,
    detail: (id: string) => ['mailboxes', id] as const
  },
  emails: {
    list: (mailboxId: string, params: Record<string, string>) => ['emails', mailboxId, params] as const,
    detail: (mailboxId: string, emailId: string) => ['emails', mailboxId, emailId] as const,
    deliveryStatus: (mailboxId: string, emailId: string) => ['emails', mailboxId, emailId, 'delivery-status'] as const,
    thread: (mailboxId: string, threadId: string) => ['emails', mailboxId, 'thread', threadId] as const
  },
  folders: {
    list: (mailboxId: string) => ['folders', mailboxId] as const
  },
  search: {
    results: (mailboxId: string, query: string, page: number) => ['search', mailboxId, query, page] as const
  },
  config: ['config'] as const
};

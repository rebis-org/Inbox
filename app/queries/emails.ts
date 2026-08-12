import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { listResponse } from '~/lib/emails';
import { requiredId } from '~/lib/utils';
import api from '~/services/api';
import type { Email } from '~/types';
import { queryKeys } from './keys';

interface EmailListResponse {
  emails: Email[],
  totalCount: number
}

export function useEmails(
  mailboxId: string | undefined,
  params: Record<string, string>,
  options?: { enabled?: boolean, refetchInterval?: number }
) {
  const queryParams = params.folder ? { ...params, threaded: 'true' } : params;

  return useQuery<EmailListResponse>({
    queryKey: mailboxId ? queryKeys.emails.list(mailboxId, queryParams) : ['emails', '_disabled'],
    queryFn: async () => listResponse(await api.listEmails(requiredId(mailboxId, 'mailboxId'), queryParams)),
    enabled: !!mailboxId && (options?.enabled ?? true),
    refetchInterval: options?.refetchInterval
  });
}

export function useEmail(mailboxId: string | undefined, emailId: string | undefined) {
  return useQuery<Email>({
    queryKey:
      mailboxId && emailId
        ? queryKeys.emails.detail(mailboxId, emailId)
        : ['emails', '_disabled_detail'],
    queryFn: () => api.getEmail(requiredId(mailboxId, 'mailboxId'), requiredId(emailId, 'emailId')),
    enabled: !!mailboxId && !!emailId
  });
}

export function useDeliveryStatus(
  mailboxId: string | undefined,
  emailId: string | undefined,
  options?: { enabled?: boolean }
) {
  const queryClient = useQueryClient();

  return useQuery<{ status: string | null, lastEventAt?: string | null }>({
    queryKey:
      mailboxId && emailId
        ? queryKeys.emails.deliveryStatus(mailboxId, emailId)
        : ['emails', '_disabled_delivery'],
    async queryFn() {
      const result = await api.getDeliveryStatus(
        requiredId(mailboxId, 'mailboxId'),
        requiredId(emailId, 'emailId')
      );
      if (result.status) {
        const current = queryClient.getQueryData<Email>(
          queryKeys.emails.detail(
            requiredId(mailboxId, 'mailboxId'),
            requiredId(emailId, 'emailId')
          )
        );
        if (current && current.delivery_status !== result.status) {
          queryClient.setQueryData(
            queryKeys.emails.detail(
              requiredId(mailboxId, 'mailboxId'),
              requiredId(emailId, 'emailId')
            ),
            {
              ...current,
              delivery_status: result.status
            }
          );
        }
      }
      return result;
    },
    enabled: !!mailboxId && !!emailId && (options?.enabled ?? true)
  });
}

export function useThreadReplies(
  mailboxId: string | undefined,
  threadId: string | undefined | null
) {
  const queryClient = useQueryClient();

  return useQuery<Email[]>({
    queryKey:
      mailboxId && threadId
        ? queryKeys.emails.thread(mailboxId, threadId)
        : ['emails', '_disabled_thread'],
    async queryFn({ signal }) {
      const emails = await api.getThread(
        requiredId(mailboxId, 'mailboxId'),
        requiredId(threadId, 'threadId'),
        { signal }
      );

      for (let i = 0, len = emails.length; i < len; i++) {
        const email = emails[i];
        queryClient.setQueryData(
          queryKeys.emails.detail(requiredId(mailboxId, 'mailboxId'), email.id),
          email
        );
      }

      return emails;
    },
    enabled: !!mailboxId && !!threadId
  });
}

function useInvalidateEmailData() {
  const queryClient = useQueryClient();
  return (mailboxId: string) => {
    queryClient.invalidateQueries({ queryKey: ['emails', mailboxId] });
    queryClient.invalidateQueries({
      queryKey: queryKeys.folders.list(mailboxId)
    });
  };
}

export function useSendEmail() {
  const invalidate = useInvalidateEmailData();
  return useMutation({
    mutationFn: ({ mailboxId, email }: { mailboxId: string, email: unknown }) => api.sendEmail(mailboxId, email),
    onSuccess: (_data, { mailboxId }) => invalidate(mailboxId)
  });
}

export function useUpdateEmail() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ mailboxId, id, data }: { mailboxId: string, id: string, data: unknown }) => api.updateEmail(mailboxId, id, data),
    async onMutate({ mailboxId, id, data }) {
      const isListQuery = (query: { queryKey: readonly unknown[] }) => query.queryKey[0] === 'emails'
        && query.queryKey[1] === mailboxId
        && typeof query.queryKey[2] === 'object'
        && query.queryKey[2] !== null;

      await queryClient.cancelQueries({
        queryKey: ['emails', mailboxId],
        predicate: isListQuery
      });

      const listQueries = queryClient.getQueriesData<{
        emails: Email[],
        totalCount: number
      }>({
        queryKey: ['emails', mailboxId],
        predicate: isListQuery
      });

      for (let i = 0, len = listQueries.length; i < len; i++) {
        const [key, cached] = listQueries[i];
        if (!cached?.emails) continue;
        queryClient.setQueryData(key, {
          ...cached,
          emails: cached.emails.map((e) => (e.id === id ? { ...e, ...(data as Partial<Email>) } : e))
        });
      }

      const detailKey = queryKeys.emails.detail(mailboxId, id);
      const prevDetail = queryClient.getQueryData<Email>(detailKey);
      if (prevDetail) {
        queryClient.setQueryData(detailKey, {
          ...prevDetail,
          ...(data as Partial<Email>)
        });
      }

      return { listQueries, prevDetail, detailKey };
    },
    onError(_err, _vars, context) {
      if (context?.listQueries) {
        for (let i = 0, len = context.listQueries.length; i < len; i++) {
          const [key, cached] = context.listQueries[i];
          queryClient.setQueryData(key, cached);
        }
      }
      if (context?.prevDetail) {
        queryClient.setQueryData(context.detailKey, context.prevDetail);
      }
    },
    onSettled(_data, _err, { mailboxId }) {
      queryClient.invalidateQueries({ queryKey: ['emails', mailboxId] });
      queryClient.invalidateQueries({
        queryKey: queryKeys.folders.list(mailboxId)
      });
    }
  });
}

export function useMarkThreadRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ mailboxId, threadId }: { mailboxId: string, threadId: string }) => api.markThreadRead(mailboxId, threadId),
    onSuccess(_data, { mailboxId }) {
      queryClient.invalidateQueries({ queryKey: ['emails', mailboxId] });
      queryClient.invalidateQueries({
        queryKey: queryKeys.folders.list(mailboxId)
      });
    }
  });
}

export function useDeleteEmail() {
  const invalidate = useInvalidateEmailData();
  return useMutation({
    mutationFn: ({ mailboxId, id }: { mailboxId: string, id: string }) => api.deleteEmail(mailboxId, id),
    onSuccess: (_data, { mailboxId }) => invalidate(mailboxId)
  });
}

export function useMoveEmail() {
  const invalidate = useInvalidateEmailData();
  return useMutation({
    mutationFn: ({
      mailboxId,
      id,
      folderId
    }: {
      mailboxId: string,
      id: string,
      folderId: string
    }) => api.moveEmail(mailboxId, id, folderId),
    onSuccess: (_data, { mailboxId }) => invalidate(mailboxId)
  });
}

export function useSaveDraft() {
  const invalidate = useInvalidateEmailData();
  return useMutation({
    mutationFn: ({
      mailboxId,
      draft
    }: {
      mailboxId: string,
      draft: {
        to?: string,
        cc?: string,
        bcc?: string,
        subject?: string,
        body: string,
        in_reply_to?: string,
        thread_id?: string,
        draft_id?: string
      }
    }) => api.saveDraft(mailboxId, draft),
    onSuccess: (_data, { mailboxId }) => invalidate(mailboxId)
  });
}

export function useReplyToEmail() {
  const invalidate = useInvalidateEmailData();
  return useMutation({
    mutationFn: ({
      mailboxId,
      emailId,
      email
    }: {
      mailboxId: string,
      emailId: string,
      email: unknown
    }) => api.replyToEmail(mailboxId, emailId, email),
    onSuccess: (_data, { mailboxId }) => invalidate(mailboxId)
  });
}

export function useForwardEmail() {
  const invalidate = useInvalidateEmailData();
  return useMutation({
    mutationFn: ({
      mailboxId,
      emailId,
      email
    }: {
      mailboxId: string,
      emailId: string,
      email: unknown
    }) => api.forwardEmail(mailboxId, emailId, email),
    onSuccess: (_data, { mailboxId }) => invalidate(mailboxId)
  });
}

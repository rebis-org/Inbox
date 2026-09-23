import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requiredId } from '~/lib/utils';
import api from '~/services/api';
import type { Mailbox } from '~/types';
import { queryKeys } from './keys';

export function useMailboxes() {
  return useQuery<Mailbox[]>({
    queryKey: queryKeys.mailboxes.all,
    queryFn: () => api.listMailboxes()
  });
}

export function useMailbox(mailboxId: string | undefined) {
  return useQuery<Mailbox>({
    queryKey: mailboxId ? queryKeys.mailboxes.detail(mailboxId) : ['mailboxes', '_disabled'],
    queryFn: () => api.getMailbox(requiredId(mailboxId, 'mailboxId')),
    enabled: !!mailboxId
  });
}

export function useCreateMailbox() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ email, name }: { email: string, name: string }) => api.createMailbox(email, name),
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: queryKeys.mailboxes.all });
    }
  });
}

export function useUpdateMailbox() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ mailboxId, settings }: { mailboxId: string, settings: unknown }) => api.updateMailbox(mailboxId, settings),
    onSuccess(_data, { mailboxId }) {
      queryClient.invalidateQueries({
        queryKey: queryKeys.mailboxes.detail(mailboxId)
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.mailboxes.all });
    }
  });
}

export function useDeleteMailbox() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (mailboxId: string) => api.deleteMailbox(mailboxId),
    onSuccess() {
      queryClient.invalidateQueries({ queryKey: queryKeys.mailboxes.all });
    }
  });
}

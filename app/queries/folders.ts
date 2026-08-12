import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { requiredId } from '~/lib/utils';
import api from '~/services/api';
import type { Folder } from '~/types';
import { queryKeys } from './keys';

export function useFolders(mailboxId: string | undefined) {
  return useQuery<Folder[]>({
    queryKey: mailboxId ? queryKeys.folders.list(mailboxId) : ['folders', '_disabled'],
    queryFn: () => api.listFolders(requiredId(mailboxId, 'mailboxId')),
    enabled: !!mailboxId
  });
}

export function useCreateFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ mailboxId, name }: { mailboxId: string, name: string }) => api.createFolder(mailboxId, name),
    onSuccess(_data, { mailboxId }) {
      queryClient.invalidateQueries({
        queryKey: queryKeys.folders.list(mailboxId)
      });
    }
  });
}

export function useUpdateFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ mailboxId, id, name }: { mailboxId: string, id: string, name: string }) => api.updateFolder(mailboxId, id, name),
    onSuccess(_data, { mailboxId }) {
      queryClient.invalidateQueries({
        queryKey: queryKeys.folders.list(mailboxId)
      });
    }
  });
}

export function useDeleteFolder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ mailboxId, id }: { mailboxId: string, id: string }) => api.deleteFolder(mailboxId, id),
    onSuccess(_data, { mailboxId }) {
      queryClient.invalidateQueries({
        queryKey: queryKeys.folders.list(mailboxId)
      });
    }
  });
}

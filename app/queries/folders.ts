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

function useFolderMutation<TVars extends { mailboxId: string }, TData = unknown>(
  mutationFn: (vars: TVars) => Promise<TData>
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess(_data, { mailboxId }) {
      queryClient.invalidateQueries({
        queryKey: queryKeys.folders.list(mailboxId)
      });
    }
  });
}

export function useCreateFolder() {
  return useFolderMutation(({ mailboxId, name }: { mailboxId: string, name: string }) => api.createFolder(mailboxId, name));
}

export function useUpdateFolder() {
  return useFolderMutation(({ mailboxId, id, name }: { mailboxId: string, id: string, name: string }) => api.updateFolder(mailboxId, id, name));
}

export function useDeleteFolder() {
  return useFolderMutation(({ mailboxId, id }: { mailboxId: string, id: string }) => api.deleteFolder(mailboxId, id));
}

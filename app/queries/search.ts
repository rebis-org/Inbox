import { useQuery } from '@tanstack/react-query';
import { listResponse } from '~/lib/emails';
import { parseSearchQuery } from '~/lib/search-parser';
import { requiredId } from '~/lib/utils';
import api from '~/services/api';
import type { Email } from '~/types';
import { queryKeys } from './keys';

export const SEARCH_PAGE_SIZE = 25;

export function useSearchEmails(mailboxId: string | undefined, query: string, page: number) {
  return useQuery<{ results: Email[], totalCount: number }>({
    queryKey:
      mailboxId && query
        ? queryKeys.search.results(mailboxId, query, page)
        : ['search', '_disabled'],
    async queryFn() {
      const parsed = parseSearchQuery(query);
      const params: Record<string, string> = {
        page: String(page),
        limit: String(SEARCH_PAGE_SIZE)
      };
      if (parsed.query) params.query = parsed.query;
      if (parsed.from) params.from = parsed.from;
      if (parsed.to) params.to = parsed.to;
      if (parsed.subject) params.subject = parsed.subject;
      if (parsed.folder) params.folder = parsed.folder;
      if (parsed.dateStart) params.date_start = parsed.dateStart;
      if (parsed.dateEnd) params.date_end = parsed.dateEnd;
      if (parsed.isRead !== undefined) params.is_read = String(parsed.isRead);
      if (parsed.isStarred !== undefined) {
        params.is_starred = String(parsed.isStarred);
      }
      if (parsed.hasAttachment) params.has_attachment = 'true';

      const data = listResponse(await api.searchEmails(requiredId(mailboxId, 'mailboxId'), params));
      return { results: data.emails, totalCount: data.totalCount };
    },
    enabled: !!mailboxId && !!query
  });
}

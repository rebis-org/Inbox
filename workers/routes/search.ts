import { routing } from 'lemmih';
import type { App } from 'lemmih';
import { apiError, json } from '../http';
import { pageOf, searchFilters } from './context';
import type { RouteContext } from './context';

export function registerSearchRoutes(app: App, { withMailbox }: RouteContext) {
  app.route(
    '/api/v1/mailboxes/:mailboxId/search',
    routing.get(
      withMailbox(async (request, _params, mailbox) => {
        if (!(await mailbox.checkSearchRateLimit())) {
          return apiError(429, 'Rate limit exceeded: max 60 searches per minute per mailbox');
        }
        const searchParams = new URL(request.url).searchParams;
        const filters = searchFilters(searchParams);
        const { page, limit } = pageOf(searchParams);
        return json({
          emails: await mailbox.searchEmails({ ...filters, page, limit }),
          totalCount: await mailbox.countSearchResults(filters)
        });
      })
    )
  );
}

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ArrowLeftIcon, SearchIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import * as v from 'valibot';
import EmailRow from '~/components/EmailRow';
import MailboxSplitView from '~/components/MailboxSplitView';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from '~/components/ui/empty';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious
} from '~/components/ui/pagination';
import { Spinner } from '~/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip';
import { useUIStore } from '~/hooks/useUIStore';
import { getSnippetText } from '~/lib/html';
import { useUpdateEmail } from '~/queries/emails';
import { SEARCH_PAGE_SIZE, useSearchEmails } from '~/queries/search';
import type { Email } from '~/types';

const SEARCH_QUOTED_OPERATOR_REGEX = /\b(?:from|to|subject|in|is|has|before|after):"[^"]*"/gi;
const SEARCH_BARE_OPERATOR_REGEX = /\b(?:from|to|subject|in|is|has|before|after):\S+/gi;
const SEARCH_ESCAPE_REGEX = /[.*+?^${}()|[\]\\]/g;

function highlightTerms(text: string, query: string): React.ReactNode {
  if (!query || !text) return text;
  const freeText = query
    .replaceAll(SEARCH_QUOTED_OPERATOR_REGEX, '')
    .replaceAll(SEARCH_BARE_OPERATOR_REGEX, '')
    .trim();
  if (!freeText) return text;
  try {
    const escaped = freeText.replaceAll(SEARCH_ESCAPE_REGEX, String.raw`\$&`);
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);
    if (parts.length === 1) return text;
    const lowerEscaped = escaped.toLowerCase();

    const highlightedParts = parts.map((part, i) => ({
      part,
      key: `${part}-${i}`,
      match: part.toLowerCase() === lowerEscaped
    }));
    return highlightedParts.map(({ part, key, match }) => (match
      ? (
        <mark key={key} className="bg-warning/15 text-foreground rounded-sm px-0.5">
          {part}
        </mark>
      )
      : (
        part
      )));
  } catch {
    return text;
  }
}

const SearchParamsSchema = v.object({
  q: v.optional(v.string(), '')
});

function validateSearch(input: unknown): v.InferOutput<typeof SearchParamsSchema> {
  const result = v.safeParse(SearchParamsSchema, input);
  return result.success ? result.output : { q: '' };
}

function folderDisplayName(name: string | null | undefined): string {
  if (!name) return '';
  const map: Record<string, string> = {
    inbox: 'Inbox',
    sent: 'Sent',
    draft: 'Drafts',
    archive: 'Archive',
    trash: 'Trash'
  };
  return map[name.toLowerCase()] || name;
}

export const Route = createFileRoute('/mailbox/$mailboxId/search')({
  validateSearch,
  component: SearchResultsRoute
});

function SearchResultsRoute() {
  const { mailboxId } = Route.useParams();
  const { q: urlQuery } = Route.useSearch();
  const navigate = useNavigate();
  const { selectedEmailId, isComposing, selectEmail, closePanel } = useUIStore();
  const updateEmailMutation = useUpdateEmail();
  const [page, setPage] = useState(1);
  const searchKey = useMemo(() => `${mailboxId}::${urlQuery}`, [mailboxId, urlQuery]);
  const [previousSearchKey, setPreviousSearchKey] = useState<string | undefined>();
  const searchChanged = previousSearchKey !== searchKey;
  if (searchChanged) {
    setPreviousSearchKey(searchKey);
    setPage(1);
  }
  const currentPage = searchChanged ? 1 : page;

  useEffect(() => {
    if (searchChanged) closePanel();
  }, [closePanel, searchChanged]);

  const { data: searchData, isLoading } = useSearchEmails(mailboxId, urlQuery, currentPage);
  const results = searchData?.results ?? [];
  const totalCount = searchData?.totalCount ?? 0;
  const isPanelOpen = selectedEmailId !== null || isComposing;

  const handleRowClick = (email: Email) => {
    selectEmail(email.id);
    if (mailboxId && !email.read) {
      updateEmailMutation.mutate({
        mailboxId,
        id: email.id,
        data: { read: true }
      });
    }
  };
  return (
    <MailboxSplitView selectedEmailId={selectedEmailId} isComposing={isComposing}>
      <div className="flex items-center gap-2 px-4 min-h-14 border-b border-border shrink-0 md:px-6">
        <Tooltip>
          <TooltipTrigger render={
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => navigate({
                to: '/mailbox/$mailboxId/emails/$folder',
                params: { mailboxId, folder: 'inbox' }
              })}
              aria-label="Back to inbox"
            />
          }
          >
            <ArrowLeftIcon />
          </TooltipTrigger>
          <TooltipContent side="bottom">Back to inbox</TooltipContent>
        </Tooltip>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-semibold text-foreground truncate">Search Results</h1>
          {!isLoading && (
            <span className="text-sm text-muted-foreground">
              {totalCount} result{totalCount === 1 ? '' : 's'}
              {urlQuery ? ` for "${urlQuery}"` : ''}
            </span>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading
          ? (
            <div className="flex justify-center py-16">
              <Spinner className="size-8" />
            </div>
          )
          : (results.length === 0
            ? (
              <Empty>
                <EmptyMedia variant="icon">
                  <SearchIcon className="text-muted-foreground" />
                </EmptyMedia>
                <EmptyHeader>
                  <EmptyTitle>No results found</EmptyTitle>
                  <EmptyDescription>
                    {urlQuery
                      ? `Nothing matched "${urlQuery}". Try different keywords or check your spelling.`
                      : 'Enter a search term to find emails by subject, sender, or content.'}
                  </EmptyDescription>
                </EmptyHeader>
                {urlQuery && (
                  <EmptyContent>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      Tip: Use operators like <code className="bg-muted px-1 rounded">from:name</code>,{' '}
                      <code className="bg-muted px-1 rounded">is:unread</code>,{' '}
                      <code className="bg-muted px-1 rounded">has:attachment</code>,{' '}
                      <code className="bg-muted px-1 rounded">before:2025-01-01</code>
                    </p>
                  </EmptyContent>
                )}
              </Empty>
            )
            : (
              <div>
                {results.map((email) => {
                  const isSelected = selectedEmailId === email.id;
                  const snippet = getSnippetText(email.snippet, 120);
                  const folderName = (email as Email & { folder_name?: string }).folder_name;
                  return (
                    <EmailRow
                      key={email.id}
                      email={email}
                      unread={!email.read}
                      isSelected={isSelected}
                      dense={isPanelOpen}
                      onOpen={() => handleRowClick(email)}
                      className="md:px-5"
                      title={highlightTerms(email.sender.split('@', 1)[0], urlQuery)}
                      meta={
                        folderName
                          ? (
                            <Badge variant="outline">{folderDisplayName(folderName)}</Badge>
                          )
                          : null
                      }
                      subtitle={
                        <span
                          className={
                            email.read ? 'text-muted-foreground' : 'font-medium text-foreground'
                          }
                        >
                          {highlightTerms(email.subject, urlQuery)}
                        </span>
                      }
                      snippet={snippet && highlightTerms(snippet, urlQuery)}
                    />
                  );
                })}
              </div>
            ))}
      </div>
      {totalCount > SEARCH_PAGE_SIZE && (
        <div className="flex justify-center py-3 border-t border-border shrink-0">
          <Pagination className="gap-2">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  aria-disabled={currentPage <= 1}
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentPage > 1) setPage(currentPage - 1);
                  }}
                />
              </PaginationItem>
              <PaginationItem>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {Math.max(1, Math.ceil(totalCount / SEARCH_PAGE_SIZE))}
                </span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  aria-disabled={currentPage >= Math.ceil(totalCount / SEARCH_PAGE_SIZE)}
                  onClick={(e) => {
                    e.preventDefault();
                    if (currentPage < Math.ceil(totalCount / SEARCH_PAGE_SIZE)) {
                      setPage(currentPage + 1);
                    }
                  }}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      )}
    </MailboxSplitView>
  );
}

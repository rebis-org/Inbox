import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ArrowLeftIcon, SearchIcon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { displayFolderLabel } from 'shared/folders';
import * as v from 'valibot';
import Bar from '~/components/Bar';
import Row from '~/components/Row';
import Mailbox from '~/components/Mailbox';
import Pager from '~/components/Pager';
import Scroll from '~/components/Scroll';
import State from '~/components/State';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Spinner } from '~/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip';
import { useUIStore } from '~/hooks/store';
import { getSnippetText } from '~/lib/html';
import { m } from '~/paraglide/messages';
import { useUpdateEmail } from '~/queries/emails';
import { useSearchEmails } from '~/queries/search';
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

export const Route = createFileRoute('/mailbox/$mailboxId/search')({
  validateSearch,
  component: SearchResultsRoute
});

function SearchResultsRoute() {
  const { mailboxId } = Route.useParams();
  const { q: urlQuery } = Route.useSearch();
  const navigate = useNavigate();
  const { selectedEmailId, isComposing, selectEmail, closePanel, locale } = useUIStore();
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
    <Mailbox selectedEmailId={selectedEmailId} isComposing={isComposing}>
      <Bar
        nav={(
          <Tooltip>
            <TooltipTrigger render={
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => navigate({
                  to: '/mailbox/$mailboxId/emails/$folder',
                  params: { mailboxId, folder: 'inbox' }
                })}
                aria-label={m.navBackToInbox()}
              />
            }
            >
              <ArrowLeftIcon />
            </TooltipTrigger>
            <TooltipContent side="bottom">{m.navBackToInbox()}</TooltipContent>
          </Tooltip>
        )}
        title={m.searchTitle()}
        sub={!isLoading && (
          <span className="text-sm text-muted-foreground">
            {totalCount === 1
              ? m.searchCountOne({ q: urlQuery })
              : m.searchCountOther({ q: urlQuery, n: totalCount })}
          </span>
        )}
      />
      <Scroll>
        {isLoading
          ? (
            <div className="flex justify-center py-16">
              <Spinner className="size-8" />
            </div>
          )
          : (results.length === 0
            ? (
              <State
                icon={<SearchIcon className="text-muted-foreground" />}
                title={m.searchNoResults()}
                desc={urlQuery ? m.searchNoResultsDesc({ q: urlQuery }) : m.searchEmptyQuery()}
                action={urlQuery && (
                  <p className="text-xs text-muted-foreground max-w-sm">
                    {m.searchTip()} <code className="bg-muted px-1 rounded">from:name</code>,{' '}
                    <code className="bg-muted px-1 rounded">is:unread</code>,{' '}
                    <code className="bg-muted px-1 rounded">has:attachment</code>,{' '}
                    <code className="bg-muted px-1 rounded">before:2025-01-01</code>
                  </p>
                )}
              />
            )
            : (
              <div>
                {results.map((email) => {
                  const isSelected = selectedEmailId === email.id;
                  const snippet = getSnippetText(email.snippet, 120);
                  const folderName = (email as Email & { folder_name?: string }).folder_name;
                  return (
                    <Row
                      key={email.id}
                      email={email}
                      unread={!email.read}
                      isSelected={isSelected}
                      dense={isPanelOpen}
                      onOpen={() => handleRowClick(email)}
                      title={highlightTerms(email.sender.split('@', 1)[0], urlQuery)}
                      meta={
                        folderName
                          ? (
                            <Badge variant="outline">{displayFolderLabel({ id: folderName, name: folderName }, locale)}</Badge>
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
      </Scroll>
      <Pager page={currentPage} totalCount={totalCount} onPrev={() => setPage(currentPage - 1)} onNext={() => setPage(currentPage + 1)} />
    </Mailbox>
  );
}

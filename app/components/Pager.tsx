import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious
} from '~/components/ui/pagination';
import { m } from '~/paraglide/messages';
import { PAGE_SIZE } from '~/queries/keys';

export default function Pager({
  page,
  totalCount,
  onPrev,
  onNext
}: {
  page: number,
  totalCount: number,
  onPrev: () => void,
  onNext: () => void
}) {
  const pages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  if (pages <= 1) return null;
  return (
    <div className="flex justify-center py-3 border-t border-border shrink-0">
      <Pagination className="gap-2">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              aria-disabled={page <= 1}
              onClick={(e) => {
                e.preventDefault();
                if (page > 1) onPrev();
              }}
            />
          </PaginationItem>
          <PaginationItem>
            <span className="text-sm text-muted-foreground">
              {m.listPageOf({ page, pages })}
            </span>
          </PaginationItem>
          <PaginationItem>
            <PaginationNext
              aria-disabled={page >= pages}
              onClick={(e) => {
                e.preventDefault();
                if (page < pages) onNext();
              }}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}

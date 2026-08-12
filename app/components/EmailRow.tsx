import type { ReactNode } from 'react';
import { formatListDate } from 'shared/dates';
import { cn } from '~/lib/utils';
import type { Email } from '~/types';

export default function EmailRow({
  email,
  unread,
  isSelected,
  dense,
  onOpen,
  leading,
  title,
  meta,
  subtitle,
  snippet,
  hoverActions,
  className
}: {
  email: Email,
  unread: boolean,
  isSelected: boolean,
  dense?: boolean,
  onOpen: () => void,
  leading?: ReactNode,
  title: ReactNode,
  meta?: ReactNode,
  subtitle?: ReactNode,
  snippet?: ReactNode,
  hoverActions?: ReactNode,
  className?: string
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        'group flex items-center gap-3 w-full text-left cursor-pointer transition-colors border-b border-border px-4 py-2.5 md:px-6 md:py-3',
        dense && 'md:px-4 md:py-2.5',
        isSelected ? 'bg-muted' : 'hover:bg-muted',
        className
      )}
    >
      <div className="w-2.5 shrink-0 flex justify-center">
        {unread && <div className="h-2 w-2 rounded-full bg-primary" />}
      </div>
      {leading}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span
            className={`truncate text-sm ${unread ? 'font-semibold text-foreground' : 'text-foreground'}`}
          >
            {title}
          </span>
          {meta}
          <span className="text-sm text-muted-foreground shrink-0 ml-auto">
            {formatListDate(email.date)}
          </span>
        </div>
        {!!subtitle && <div className="truncate text-sm mt-0.5">{subtitle}</div>}
        {!!snippet && (
          <div className="truncate text-xs text-muted-foreground mt-0.5">{snippet}</div>
        )}
      </div>
      {!!hoverActions && (
        <div className="hidden group-hover:flex items-center shrink-0">{hoverActions}</div>
      )}
    </div>
  );
}

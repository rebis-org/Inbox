import type { ReactNode } from 'react';
import { cn } from '~/lib/utils';

export default function Bar({
  nav,
  title,
  sub,
  actions,
  titleClassName
}: {
  nav?: ReactNode,
  title: ReactNode,
  sub?: ReactNode,
  actions?: ReactNode,
  titleClassName?: string
}) {
  return (
    <div className="flex items-center gap-2 px-4 min-h-14 border-b border-border shrink-0 md:px-6">
      {nav}
      <div className="min-w-0 flex-1">
        <div className={cn('font-semibold text-foreground truncate', titleClassName ?? 'text-lg')}>
          {title}
        </div>
        {sub}
      </div>
      {actions}
    </div>
  );
}

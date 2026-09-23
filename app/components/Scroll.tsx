import type { HTMLAttributes, PropsWithChildren } from 'react';
import { cn } from '~/lib/utils';

type ScrollProps = PropsWithChildren<HTMLAttributes<HTMLDivElement>>;

export default function Scroll({ children, className, ...rest }: ScrollProps) {
  return <div className={cn('flex-1 overflow-y-auto', className)} {...rest}>{children}</div>;
}

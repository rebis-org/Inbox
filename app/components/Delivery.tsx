import { useUIStore } from '~/hooks/store';
import { m } from '~/paraglide/messages';
import type { Locale } from '~/paraglide/runtime';

type DeliveryLabelKey =
  | 'deliveryDelivered'
  | 'deliveryDelayed'
  | 'deliveryBounced'
  | 'deliveryComplained'
  | 'deliveryFailed'
  | 'deliverySuppressed'
  | 'deliveryScheduled'
  | 'deliveryQueued';

const STATUS_META: Partial<Record<string, { label: DeliveryLabelKey, className: string }>> = {
  delivered: {
    label: 'deliveryDelivered',
    className: 'text-success bg-success/15'
  },
  delayed: {
    label: 'deliveryDelayed',
    className: 'text-warning bg-warning/15'
  },
  bounced: {
    label: 'deliveryBounced',
    className: 'text-destructive bg-destructive/15'
  },
  complained: {
    label: 'deliveryComplained',
    className: 'text-destructive bg-destructive/15'
  },
  failed: {
    label: 'deliveryFailed',
    className: 'text-destructive bg-destructive/15'
  },
  suppressed: {
    label: 'deliverySuppressed',
    className: 'text-destructive bg-destructive/15'
  },
  scheduled: {
    label: 'deliveryScheduled',
    className: 'text-muted-foreground bg-muted'
  },
  queued: {
    label: 'deliveryQueued',
    className: 'text-muted-foreground bg-muted'
  }
};

export function deliveryStatusLabel(status?: string | null, locale: Locale = 'en'): string | null {
  if (!status || status === 'sent') return null;
  const key = STATUS_META[status]?.label;
  return key ? m[key]({}, { locale }) : status;
}

export default function Delivery({
  status,
  className
}: {
  status?: string | null,
  className?: string
}) {
  const { locale } = useUIStore();
  const label = deliveryStatusLabel(status, locale);
  if (!label) return null;

  const meta = STATUS_META[status ?? ''];
  return (
    <span
      className={`shrink-0 text-[11px] font-medium rounded-full px-1.5 py-0.5 ${
        meta?.className ?? 'text-muted-foreground bg-muted'
      } ${className ?? ''}`}
    >
      {label}
    </span>
  );
}

const STATUS_META: Partial<Record<string, { label: string, className: string }>> = {
  delivered: {
    label: 'Delivered',
    className: 'text-success bg-success/15'
  },
  delayed: {
    label: 'Delayed',
    className: 'text-warning bg-warning/15'
  },
  bounced: {
    label: 'Bounced',
    className: 'text-destructive bg-destructive/15'
  },
  complained: {
    label: 'Complained',
    className: 'text-destructive bg-destructive/15'
  },
  failed: {
    label: 'Failed',
    className: 'text-destructive bg-destructive/15'
  },
  suppressed: {
    label: 'Suppressed',
    className: 'text-destructive bg-destructive/15'
  },
  scheduled: {
    label: 'Scheduled',
    className: 'text-muted-foreground bg-muted'
  },
  queued: {
    label: 'Queued',
    className: 'text-muted-foreground bg-muted'
  }
};

export function deliveryStatusLabel(status?: string | null): string | null {
  if (!status || status === 'sent') return null;
  return STATUS_META[status]?.label ?? status;
}

export default function DeliveryStatusBadge({
  status,
  className
}: {
  status?: string | null,
  className?: string
}) {
  const label = deliveryStatusLabel(status);
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

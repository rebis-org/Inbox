function safeParse(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

function withDate<T>(dateStr: string | undefined | null, fallback: T, format: (date: Date) => T): T {
  const date = safeParse(dateStr);
  return date ? format(date) : fallback;
}

export function formatListDate(dateStr: string): string {
  return withDate(dateStr, dateStr, (date) => {
    const now = new Date();
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString(undefined, {
        hour: 'numeric',
        minute: '2-digit'
      });
    }
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric'
      });
    }
    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  });
}

export function formatDetailDate(dateStr: string): string {
  return withDate(
    dateStr,
    dateStr,
    (date) => date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  );
}

export function formatShortDate(dateStr: string): string {
  return withDate(
    dateStr,
    dateStr,
    (date) => date.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit'
    })
  );
}

export function formatQuotedDate(dateStr: string | undefined): string {
  return withDate(dateStr, dateStr ?? '', (date) => date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  }));
}

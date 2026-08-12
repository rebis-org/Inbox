function safeParse(dateStr: string | undefined | null): Date | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

export function formatListDate(dateStr: string): string {
  const date = safeParse(dateStr);
  if (!date) return dateStr;

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
}

export function formatDetailDate(dateStr: string): string {
  const date = safeParse(dateStr);
  if (!date) return dateStr;

  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  });
}

export function formatShortDate(dateStr: string): string {
  const date = safeParse(dateStr);
  if (!date) return dateStr;

  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit'
  });
}

export function formatQuotedDate(dateStr: string | undefined): string {
  if (!dateStr) return '';
  const date = safeParse(dateStr);
  if (!date) return dateStr;

  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

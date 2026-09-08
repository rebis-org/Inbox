export interface ParsedSearch {
  query: string,
  from?: string,
  to?: string,
  subject?: string,
  folder?: string,
  isRead?: boolean,
  isStarred?: boolean,
  hasAttachment?: boolean,
  dateStart?: string,
  dateEnd?: string
}

const OPERATOR_RE = /\b(from|to|subject|in|is|has|before|after):(?:"([^"]*)"|(\S+))/gi;
const SEARCH_WHITESPACE_REGEX = /\s+/g;

const IS_VALUES: Partial<Record<string, Partial<ParsedSearch>>> = {
  unread: { isRead: false },
  read: { isRead: true },
  starred: { isStarred: true },
  unstarred: { isStarred: false }
};

function applyOperator(acc: ParsedSearch, op: string, value: string): ParsedSearch {
  switch (op) {
    case 'from':
    case 'to':
    case 'subject':
      return { ...acc, [op]: value };
    case 'in':
      return { ...acc, folder: value.toLowerCase() };
    case 'is':
      return { ...acc, ...IS_VALUES[value.toLowerCase()] };
    case 'has':
      return value.toLowerCase() === 'attachment' ? { ...acc, hasAttachment: true } : acc;
    case 'before':
      return { ...acc, dateEnd: normalizeDate(value) };
    case 'after':
      return { ...acc, dateStart: normalizeDate(value) };
    default:
      return acc;
  }
}

export function parseSearchQuery(input: string): ParsedSearch {
  OPERATOR_RE.lastIndex = 0;
  const matches = Array.from(input.matchAll(OPERATOR_RE), (match) => ({
    fullMatch: match[0],
    op: match[1].toLowerCase(),
    value: (match[2] as string | undefined) ?? match[3]
  }));

  const query = matches
    .reduce((remaining, m) => remaining.replace(m.fullMatch, ''), input)
    .replaceAll(SEARCH_WHITESPACE_REGEX, ' ')
    .trim();

  return matches.reduce<ParsedSearch>(
    (acc, { op, value }) => applyOperator(acc, op, value),
    { query }
  );
}

function normalizeDate(value: string): string | undefined {
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return undefined;
    return d.toISOString();
  } catch {
    return undefined;
  }
}

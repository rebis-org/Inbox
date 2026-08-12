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

export function parseSearchQuery(input: string): ParsedSearch {
  const result: ParsedSearch = { query: '' };

  let remaining = input;
  let match: RegExpExecArray | null;

  OPERATOR_RE.lastIndex = 0;
  const matches: Array<{ fullMatch: string, op: string, value: string }> = [];

  match = OPERATOR_RE.exec(input);
  while (match !== null) {
    const op = match[1].toLowerCase();
    const value = (match[2] as string | undefined) ?? match[3];
    matches.push({ fullMatch: match[0], op, value });
    match = OPERATOR_RE.exec(input);
  }

  for (let i = 0, len = matches.length; i < len; i++) {
    const m = matches[i];
    remaining = remaining.replace(m.fullMatch, '');
  }

  result.query = remaining.replaceAll(SEARCH_WHITESPACE_REGEX, ' ').trim();

  for (let i = 0, len = matches.length; i < len; i++) {
    const { op, value } = matches[i];
    switch (op) {
      case 'from':
        result.from = value;
        break;
      case 'to':
        result.to = value;
        break;
      case 'subject':
        result.subject = value;
        break;
      case 'in':
        result.folder = value.toLowerCase();
        break;
      case 'is':
        switch (value.toLowerCase()) {
          case 'unread':
            result.isRead = false;
            break;
          case 'read':
            result.isRead = true;
            break;
          case 'starred':
            result.isStarred = true;
            break;
          case 'unstarred':
            result.isStarred = false;
            break;
          default:
            break;
        }
        break;
      case 'has':
        if (value.toLowerCase() === 'attachment') {
          result.hasAttachment = true;
        }
        break;
      case 'before':
        result.dateEnd = normalizeDate(value);
        break;
      case 'after':
        result.dateStart = normalizeDate(value);
        break;
      default:
        break;
    }
  }

  return result;
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

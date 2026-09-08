import { default as DOMPurify } from 'dompurify';
import { decode, encode } from 'html-entities';

const HTML_TAG_REGEX = /<[^>]*>/g;
const HTML_WHITESPACE_REGEX = /\s+/g;
const STYLE_BLOCK_REGEX = /<style[^>]*>[\s\S]*?<\/style>/gi;
const BR_TAG_REGEX = /<br\s*\/?>/gi;
const P_CLOSE_TAG_REGEX = /<\/p>/gi;
const P_OPEN_TAG_REGEX = /<p[^>]*>/gi;
const DIV_OPEN_TAG_REGEX = /<div[^>]*>/gi;
const DIV_CLOSE_TAG_REGEX = /<\/div>/gi;
const UNCLOSED_STYLE_REGEX = /<style[^>]*>[\s\S]*/gi;
const UNCLOSED_TAG_REGEX = /<[^>]*$/g;

export function escapeHtml(text: string): string {
  return encode(text);
}

export function stripHtml(html: string): string {
  return html.replaceAll(HTML_TAG_REGEX, '').replaceAll(HTML_WHITESPACE_REGEX, ' ').trim();
}

const stripStyles = (html: string) => html.replaceAll(STYLE_BLOCK_REGEX, '');
const collapseWhitespace = (text: string) => text.replaceAll(HTML_WHITESPACE_REGEX, ' ').trim();

export function htmlToPlainText(html: string): string {
  const sanitized = DOMPurify.sanitize(html);
  const div = document.createElement('div');
  div.innerHTML = stripStyles(sanitized)
    .replaceAll(BR_TAG_REGEX, '\n')
    .replaceAll(P_CLOSE_TAG_REGEX, '\n\n')
    .replaceAll(P_OPEN_TAG_REGEX, '')
    .replaceAll(DIV_OPEN_TAG_REGEX, '')
    .replaceAll(DIV_CLOSE_TAG_REGEX, '\n');
  return (div.textContent || '').trim();
}

export function getSnippetText(snippet?: string | null, maxLength = 100): string {
  if (!snippet) return '';
  const clean = collapseWhitespace(decode(
    stripStyles(snippet)
      .replaceAll(UNCLOSED_STYLE_REGEX, '')
      .replaceAll(HTML_TAG_REGEX, ' ')
      .replaceAll(UNCLOSED_TAG_REGEX, ''),
    { scope: 'strict' }
  ));
  if (!clean) return '';
  return clean.length > maxLength ? `${clean.slice(0, maxLength)}...` : clean;
}

export function getSignatureBlock(settings?: {
  signature?: { enabled: boolean, text?: string, html?: string }
}): string {
  const sig = settings?.signature;
  if (!sig?.enabled || (!sig.html && !sig.text)) return '';
  const content = sig.html ? DOMPurify.sanitize(sig.html) : escapeHtml(sig.text || '');
  return `<div style="border-top: 1px solid #ccc; margin-top: 16px; padding-top: 12px;">${content}</div>`;
}

export function buildQuotedReplyBlock(
  dateStr: string | undefined,
  sender: string,
  body: string,
  wroteLine: string
): string {
  if (!body) return '';
  const bodyToQuote = escapeHtml(stripHtml(body)).replaceAll('\n', '<br>');
  return `<br><blockquote style="border-left: 2px solid #ccc; margin: 0; padding-left: 1em; color: #666;">${wroteLine}<br><br>${bodyToQuote}</blockquote>`;
}

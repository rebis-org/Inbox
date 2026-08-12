import { $generateHtmlFromNodes, $generateNodesFromDOM } from '@lexical/html';
import { LinkNode } from '@lexical/link';
import { ListItemNode, ListNode } from '@lexical/list';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { default as DOMPurify } from 'dompurify';
import {
  $createTextNode,
  $getRoot,
  $getSelection,
  $insertNodes,
  $isRangeSelection,
  COMMAND_PRIORITY_CRITICAL,
  createCommand,
  DecoratorNode,
  isHTMLElement,
  PASTE_COMMAND,
  TextNode
} from 'lexical';
import type {
  DOMConversionOutput,
  EditorConfig,
  LexicalNode,
  PasteCommandType,
  TextFormatType
} from 'lexical';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import LexicalToolbar from './LexicalToolbar';

const STYLE_FORMAT_TAGS: Partial<Record<string, TextFormatType>> = {
  b: 'bold',
  strong: 'bold',
  i: 'italic',
  em: 'italic',
  u: 'underline',
  s: 'strikethrough',
  strike: 'strikethrough',
  mark: 'highlight'
};

class StyledTextNode extends TextNode {
  static getType(): string {
    return 'styled-text';
  }

  static clone(node: StyledTextNode): StyledTextNode {
    return new StyledTextNode(node.__text, node.__key);
  }

  $config() {
    return this.config('styled-text', {
      extends: TextNode,
      importDOM: {
        span: () => ({
          conversion(domNode: HTMLElement): DOMConversionOutput | null {
            const color = domNode.style.color;
            const background = domNode.style.backgroundColor;
            if (!color && !background) return null;

            const isSimple = Array.from(domNode.childNodes).every(
              (child) => child.nodeType === Node.TEXT_NODE
                || (isHTMLElement(child)
                  && STYLE_FORMAT_TAGS[child.tagName.toLowerCase()] !== undefined)
            );
            if (!isSimple) return null;

            const style = `${[
              color && `color: ${color}`,
              background && `background-color: ${background}`
            ]
              .filter(Boolean)
              .join('; ')};`;
            const nodes: LexicalNode[] = [];
            const children = Array.from(domNode.childNodes);
            for (let i = 0, len = children.length; i < len; i++) {
              const child = children[i];
              if (child.nodeType === Node.TEXT_NODE) {
                const text = child.textContent;
                if (!text) continue;
                const textNode = $createTextNode(text);
                textNode.setStyle(style);
                nodes.push(textNode);
              } else if (isHTMLElement(child)) {
                const text = child.textContent;
                if (!text) continue;
                const textNode = $createTextNode(text);
                const format = STYLE_FORMAT_TAGS[child.tagName.toLowerCase()];
                if (format) textNode.toggleFormat(format);
                textNode.setStyle(style);
                nodes.push(textNode);
              }
            }
            if (nodes.length === 0) return null;
            return { node: nodes };
          },
          priority: 2
        })
      }
    });
  }
}

class InlineImageNode extends DecoratorNode<ReactNode> {
  __src: string;
  __altText: string;

  static getType(): string {
    return 'inline-image';
  }

  static clone(node: InlineImageNode): InlineImageNode {
    return new InlineImageNode(node.__src, node.__altText, node.__key);
  }

  constructor(src = '', altText = '', key?: string) {
    super(key);
    this.__src = src;
    this.__altText = altText || '';
  }

  getSrc(): string {
    return this.getLatest().__src;
  }

  getAltText(): string {
    return this.getLatest().__altText;
  }

  isInline(): boolean {
    return true;
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const span = document.createElement('span');
    span.dataset.lexicalInlineImage = 'true';
    return span;
  }

  updateDOM(): boolean {
    return false;
  }

  decorate(): ReactNode {
    return (
      <img
        src={this.getSrc()}
        alt={this.getAltText()}
        className="inline-block max-h-64 max-w-full object-contain rounded-sm align-middle"
        draggable={false}
      />
    );
  }

  exportDOM(): { element: HTMLElement } {
    const img = document.createElement('img');
    img.setAttribute('src', this.getSrc());
    if (this.getAltText()) img.setAttribute('alt', this.getAltText());
    return { element: img };
  }

  exportJSON() {
    return {
      ...super.exportJSON(),
      src: this.getSrc(),
      altText: this.getAltText()
    };
  }

  static importJSON(serializedNode: Record<string, unknown>): InlineImageNode {
    const src = typeof serializedNode.src === 'string' ? serializedNode.src : '';
    const altText = typeof serializedNode.altText === 'string' ? serializedNode.altText : '';
    return new InlineImageNode(src, altText);
  }

  $config() {
    return this.config('inline-image', {
      extends: DecoratorNode,
      importDOM: {
        img: () => ({
          conversion(domNode: HTMLElement): DOMConversionOutput | null {
            if (!isHTMLElement(domNode)) return null;
            const src = domNode.getAttribute('src');
            if (!src) return null;
            return {
              node: new InlineImageNode(src, domNode.getAttribute('alt') || '')
            };
          },
          priority: 0
        })
      }
    });
  }
}

export const INSERT_INLINE_IMAGE_COMMAND = createCommand<string>('INSERT_INLINE_IMAGE_COMMAND');

function ValueSyncPlugin({ value }: { value: string }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    const current = editor.read(() => $generateHtmlFromNodes(editor));
    if (value === current) return;
    editor.update(() => {
      const root = $getRoot();
      root.clear();
      if (value) {
        const sanitized = DOMPurify.sanitize(value);
        const dom = new DOMParser().parseFromString(sanitized, 'text/html');
        const nodes = $generateNodesFromDOM(editor, dom);
        root.append(...nodes);
      }
    });
  }, [value, editor]);

  return null;
}

function PasteSanitizePlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(
    () => editor.registerCommand(
      PASTE_COMMAND,
      (event: PasteCommandType) => {
        const clipboardData = event instanceof ClipboardEvent ? event.clipboardData : null;
        if (!clipboardData) return false;
        const html = clipboardData.getData('text/html');
        if (!html) return false;
        event.preventDefault();
        const sanitized = DOMPurify.sanitize(html);
        const dom = new DOMParser().parseFromString(sanitized, 'text/html');
        editor.update(() => {
          const nodes = $generateNodesFromDOM(editor, dom);
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            selection.insertNodes(nodes);
          } else {
            $insertNodes(nodes);
          }
        });
        return true;
      },
      COMMAND_PRIORITY_CRITICAL
    ),
    [editor]
  );

  return null;
}

function ImageCommandPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(
    () => editor.registerCommand(
      INSERT_INLINE_IMAGE_COMMAND,
      (src: string) => {
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            selection.insertNodes([new InlineImageNode(src, '')]);
          }
        });
        return true;
      },
      COMMAND_PRIORITY_CRITICAL
    ),
    [editor]
  );

  return null;
}

interface RichTextEditorProps {
  value: string,
  onChange: (value: string) => void
}

const editorInitialConfig = {
  namespace: 'inbox-editor',
  nodes: [
    StyledTextNode,
    InlineImageNode,
    HeadingNode,
    QuoteNode,
    ListNode,
    ListItemNode,
    LinkNode
  ],
  theme: {
    text: {
      bold: 'font-bold',
      italic: 'italic',
      underline: 'underline',
      strikethrough: 'line-through'
    },
    link: 'text-primary underline'
  },
  onError(error: Error) {
    // eslint-disable-next-line no-console
    console.error(error);
  }
};

export default function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  if (typeof window === 'undefined') return null;

  return (
    <div className="rounded-2xl border border-border overflow-hidden flex flex-col h-full">
      <LexicalComposer initialConfig={editorInitialConfig}>
        <LexicalToolbar />
        <div className="flex-1 overflow-y-auto">
          <RichTextPlugin
            contentEditable={
              <ContentEditable className="lexical-editor prose prose-sm max-w-none focus:outline-none min-h-[180px] p-3 text-sm [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-muted-foreground [&_blockquote]:bg-muted [&_blockquote]:py-1 [&_blockquote]:my-2 [&_blockquote]:text-xs [&_blockquote]:rounded-r-sm" />
            }
            placeholder={null}
            ErrorBoundary={LexicalErrorBoundary}
          />
        </div>
        <HistoryPlugin />
        <LinkPlugin />
        <ListPlugin />
        <OnChangePlugin
          onChange={(_editorState, editor) => {
            onChange(editor.read(() => $generateHtmlFromNodes(editor)));
          }}
        />
        <ValueSyncPlugin value={value} />
        <PasteSanitizePlugin />
        <ImageCommandPlugin />
      </LexicalComposer>
    </div>
  );
}

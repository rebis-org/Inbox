import { $isLinkNode, LinkNode, TOGGLE_LINK_COMMAND } from '@lexical/link';
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  ListNode
} from '@lexical/list';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $createQuoteNode, $isQuoteNode, QuoteNode } from '@lexical/rich-text';
import { $patchStyleText, $setBlocksType } from '@lexical/selection';
import { $getNearestNodeOfType } from '@lexical/utils';
import {
  $createParagraphNode,
  $getSelection,
  $isElementNode,
  $isRangeSelection,
  COMMAND_PRIORITY_LOW,
  FORMAT_ELEMENT_COMMAND,
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  SELECTION_CHANGE_COMMAND,
  UNDO_COMMAND
} from 'lexical';
import type { ElementFormatType, ElementNode, TextFormatType } from 'lexical';
import {
  AlignCenterIcon,
  AlignJustifyIcon,
  AlignLeftIcon,
  AlignRightIcon,
  BoldIcon,
  HighlighterIcon,
  ImageIcon,
  ItalicIcon,
  Link2OffIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  PaintBucketIcon,
  QuoteIcon,
  RotateCcwIcon,
  RotateCwIcon,
  StrikethroughIcon,
  UnderlineIcon
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '~/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '~/components/ui/dialog';
import { Field, FieldLabel } from '~/components/ui/field';
import { Input } from '~/components/ui/input';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip';
import { INSERT_INLINE_IMAGE_COMMAND } from './Editor';
import { m } from '~/paraglide/messages';

interface ToolbarState {
  bold: boolean,
  italic: boolean,
  underline: boolean,
  strikethrough: boolean,
  highlight: boolean,
  link: boolean,
  bulletList: boolean,
  orderedList: boolean,
  quote: boolean,
  align: 'left' | 'center' | 'right' | 'justify' | null
}

const INITIAL_STATE: ToolbarState = {
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  highlight: false,
  link: false,
  bulletList: false,
  orderedList: false,
  quote: false,
  align: null
};

const FORMAT_TO_ALIGN: Record<number, 'left' | 'center' | 'right' | 'justify'> = {
  1: 'left',
  2: 'center',
  3: 'right',
  4: 'justify'
};

function toolButton(label: string,
  icon: React.ReactNode,
  active: boolean,
  onClick: () => void,
  disabled = false) {
  return (
    <Tooltip key={label}>
      <TooltipTrigger render={
        <Button
          variant={active ? 'secondary' : 'ghost'}
          size="icon-sm"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
        />
      }
      >
        {icon}
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

export default function Formatting() {
  const [editor] = useLexicalComposerContext();
  const [state, setState] = useState<ToolbarState>(INITIAL_STATE);
  const [prompt, setPrompt] = useState<{
    title: string,
    placeholder: string,
    submit: (value: string) => void
  } | null>(null);
  const [promptValue, setPromptValue] = useState('');

  useEffect(() => {
    const update = () => {
      const editorState = editor.getEditorState();
      editorState.read(() => {
        const selection = $getSelection();
        let bold = false;
        let italic = false;
        let underline = false;
        let strikethrough = false;
        let highlight = false;
        let link = false;
        let bulletList = false;
        let orderedList = false;
        let quote = false;
        let align: 'left' | 'center' | 'right' | 'justify' | null = null;

        if ($isRangeSelection(selection)) {
          bold = selection.hasFormat('bold');
          italic = selection.hasFormat('italic');
          underline = selection.hasFormat('underline');
          strikethrough = selection.hasFormat('strikethrough');
          highlight = selection.hasFormat('highlight');

          const node = selection.anchor.getNode();
          link = $isLinkNode(node) || $getNearestNodeOfType(node, LinkNode) !== null;
          const listNode = $getNearestNodeOfType(node, ListNode);
          bulletList = listNode?.getListType() === 'bullet';
          orderedList = listNode?.getListType() === 'number';
          quote = $isQuoteNode(node) || $getNearestNodeOfType(node, QuoteNode) !== null;

          const topLevel = node.getTopLevelElement();
          if (topLevel && $isElementNode(topLevel)) {
            align = FORMAT_TO_ALIGN[topLevel.getFormat()] ?? null;
          }
        }

        setState({
          bold,
          italic,
          underline,
          strikethrough,
          highlight,
          link,
          bulletList,
          orderedList,
          quote,
          align
        });
      });
    };

    const unregister = [
      editor.registerCommand(
        SELECTION_CHANGE_COMMAND,
        () => {
          update();
          return false;
        },
        COMMAND_PRIORITY_LOW
      ),
      editor.registerUpdateListener(update),
      editor.registerEditableListener(update)
    ];
    update();
    return () => {
      unregister.forEach((fn) => {
        fn();
      });
    };
  }, [editor]);

  const ask = (title: string, placeholder: string, submit: (value: string) => void) => {
    setPromptValue('');
    setPrompt({ title, placeholder, submit });
  };

  const setLink = () => {
    if (state.link) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
      return;
    }
    ask(m.formatLinkTitle(), 'https://example.com', (url) => {
      if (url.trim()) editor.dispatchCommand(TOGGLE_LINK_COMMAND, url.trim());
    });
  };

  const setColor = () => {
    ask(m.formatColorTitle(), '#FF0000', (hex) => {
      if (!hex.trim()) return;
      const color = hex.trim();
      editor.update(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
          $patchStyleText(selection, { color });
        }
      });
    });
  };

  const setImage = () => {
    ask(m.formatImageTitle(), 'https://example.com/image.png or cid:reference', (url) => {
      if (url.trim()) editor.dispatchCommand(INSERT_INLINE_IMAGE_COMMAND, url.trim());
    });
  };

  const toggleFormat = (type: TextFormatType) => {
    editor.dispatchCommand(FORMAT_TEXT_COMMAND, type);
  };

  const toggleList = (type: 'bullet' | 'number') => {
    editor.dispatchCommand(
      type === 'bullet' ? INSERT_UNORDERED_LIST_COMMAND : INSERT_ORDERED_LIST_COMMAND,
      undefined
    );
  };

  const toggleAlign = (type: ElementFormatType) => {
    editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, type);
  };

  const toggleQuote = () => {
    editor.update(() => {
      const selection = $getSelection();
      if (!$isRangeSelection(selection)) return;
      const isQuote = selection.getNodes().some((node) => $isQuoteNode(node));
      const createBlock = (() => (isQuote ? $createParagraphNode() : $createQuoteNode())) as () => ElementNode;
      $setBlocksType(selection, createBlock);
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 bg-muted px-2 py-1.5 border-b border-border shrink-0">
      {toolButton(m.formatBold(), <BoldIcon size={16} />, state.bold, () => toggleFormat('bold'))}
      {toolButton(m.formatItalic(), <ItalicIcon size={16} />, state.italic, () => toggleFormat('italic'))}
      {toolButton(m.formatUnderline(), <UnderlineIcon size={16} />, state.underline, () => toggleFormat('underline'))}
      {toolButton(m.formatStrikethrough(), <StrikethroughIcon size={16} />, state.strikethrough, () => toggleFormat('strikethrough'))}
      {toolButton(m.formatHighlight(), <HighlighterIcon size={16} />, state.highlight, () => toggleFormat('highlight'))}
      {toolButton(m.formatTextColor(), <PaintBucketIcon size={16} />, false, setColor)}

      <div className="mx-1 h-5 w-px bg-border" />

      {toolButton(m.formatBullet(), <ListIcon size={16} />, state.bulletList, () => toggleList('bullet'))}
      {toolButton(m.formatNumbered(), <ListOrderedIcon size={16} />, state.orderedList, () => toggleList('number'))}
      {toolButton(m.formatQuote(), <QuoteIcon size={16} />, state.quote, toggleQuote)}

      <div className="mx-1 h-5 w-px bg-border" />

      {toolButton(m.formatAlignLeft(), <AlignLeftIcon size={16} />, state.align === 'left', () => toggleAlign('left'))}
      {toolButton(m.formatAlignCenter(), <AlignCenterIcon size={16} />, state.align === 'center', () => toggleAlign('center'))}
      {toolButton(m.formatAlignRight(), <AlignRightIcon size={16} />, state.align === 'right', () => toggleAlign('right'))}
      {toolButton(m.formatJustify(), <AlignJustifyIcon size={16} />, state.align === 'justify', () => toggleAlign('justify'))}

      <div className="mx-1 h-5 w-px bg-border" />

      {toolButton(m.formatLink(), <LinkIcon size={16} />, state.link, setLink)}
      {state.link
        && toolButton(m.formatRemoveLink(), <Link2OffIcon size={16} />, false, () => editor.dispatchCommand(TOGGLE_LINK_COMMAND, null))}
      {toolButton(m.formatImage(), <ImageIcon size={16} />, false, setImage)}

      <div className="mx-1 h-5 w-px bg-border" />

      {toolButton(m.formatUndo(), <RotateCcwIcon size={16} />, false, () => editor.dispatchCommand(UNDO_COMMAND, undefined))}
      {toolButton(m.formatRedo(), <RotateCwIcon size={16} />, false, () => editor.dispatchCommand(REDO_COMMAND, undefined))}

      <Dialog open={prompt !== null} onOpenChange={(open) => !open && setPrompt(null)}>
        <DialogContent className="p-6 sm:max-w-xs">
          <DialogTitle className="text-base font-semibold mb-4">{prompt?.title}</DialogTitle>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              prompt?.submit(promptValue);
              setPrompt(null);
            }}
            className="flex flex-col gap-4"
          >
            <Field>
              <FieldLabel htmlFor="toolbar-prompt">{m.formatValue()}</FieldLabel>
              <Input
                id="toolbar-prompt"
                placeholder={prompt?.placeholder}
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                autoFocus
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" size="sm" onClick={() => setPrompt(null)}>
                {m.navCancel()}
              </Button>
              <Button type="submit" variant="default" size="sm" disabled={!promptValue.trim()}>
                {m.formatApply()}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

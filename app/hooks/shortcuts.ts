import { useEffect } from 'react';
import { tinykeys } from 'tinykeys';

export interface ShortcutHandlers {
  onNext: () => void,
  onPrev: () => void,
  onCompose: () => void,
  onSearch: () => void,
  onEscape: () => void
}

function isTyping(target: EventTarget | null) {
  return target instanceof HTMLElement
    && !!target.closest('input, textarea, select, [contenteditable="true"]');
}

export function useShortcuts({ onNext, onPrev, onCompose, onSearch, onEscape }: ShortcutHandlers) {
  useEffect(() => tinykeys(window, {
    j(event) {
      event.preventDefault();
      onNext();
    },
    k(event) {
      event.preventDefault();
      onPrev();
    },
    c(event) {
      event.preventDefault();
      onCompose();
    },
    '/': (event) => {
      event.preventDefault();
      onSearch();
    },
    Escape: () => onEscape(),
    'Shift+Escape': () => onEscape()
  }, {
    ignore: (event) => isTyping(event.target)
  }), [onNext, onPrev, onCompose, onSearch, onEscape]);
}

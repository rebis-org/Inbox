import { create } from 'zustand';
import { overwriteGetLocale, setLocale } from '~/paraglide/runtime';
import type { Locale } from '~/paraglide/runtime';
import type { Email } from '~/types';

export type ComposeMode = 'new' | 'reply' | 'reply-all' | 'forward';
export type LanguageSetting = 'system' | Locale;

function syncParaglideLocale(locale: Locale) {
  if (typeof window === 'undefined') return;
  void setLocale(locale, { reload: false });
}

function resolveLocale(language: LanguageSetting): Locale {
  if (language === 'en' || language === 'zh') return language;
  try {
    const nav = typeof navigator === 'undefined' ? '' : navigator.language.toLowerCase();
    return nav.startsWith('zh') ? 'zh' : 'en';
  } catch {
    return 'en';
  }
}

function storedLanguage(): LanguageSetting {
  try {
    const saved = localStorage.getItem('language');
    return saved === 'en' || saved === 'zh' ? saved : 'system';
  } catch {
    return 'system';
  }
}

export interface ComposeOptions {
  mode: ComposeMode,
  originalEmail?: Email | null,
  draftEmail?: Email | null
}

interface UIState {
  selectedEmailId: string | null,
  isComposing: boolean,
  _previousEmailId: string | null,
  selectEmail: (id: string | null) => void,
  startCompose: (options?: ComposeOptions) => void,
  closePanel: () => void,
  closeCompose: () => void,

  composeOptions: ComposeOptions,

  isSidebarOpen: boolean,
  openSidebar: () => void,
  closeSidebar: () => void,
  toggleSidebar: () => void,

  isSidebarCollapsed: boolean,
  toggleSidebarCollapsed: () => void,

  searchFocusToken: number,
  focusSearch: () => void,

  language: LanguageSetting,
  locale: Locale,
  setLanguage: (language: LanguageSetting) => void,
  initLocale: () => void,

  isComposeModalOpen: boolean,
  openComposeModal: (options?: ComposeOptions) => void,
  closeComposeModal: () => void
}

export const useUIStore = create<UIState>((set, get) => ({
  selectedEmailId: null,
  isComposing: false,
  _previousEmailId: null,
  composeOptions: { mode: 'new', originalEmail: null },
  isComposeModalOpen: false,
  isSidebarOpen: false,

  selectEmail: (id) => set({ selectedEmailId: id, isComposing: false }),

  startCompose: (options) => set((state) => {
    const mode = options?.mode || 'new';
    const isReplyOrForward = mode === 'reply' || mode === 'reply-all' || mode === 'forward';
    return {
      isComposing: true,
      _previousEmailId: state.selectedEmailId,

      selectedEmailId: isReplyOrForward ? state.selectedEmailId : null,
      composeOptions: options || { mode: 'new', originalEmail: null },
      isSidebarOpen: false
    };
  }),

  closePanel: () => set({
    selectedEmailId: null,
    isComposing: false,
    _previousEmailId: null,
    composeOptions: { mode: 'new' as const, originalEmail: null }
  }),

  closeCompose: () => set((state) => ({
    isComposing: false,
    selectedEmailId: state._previousEmailId,
    _previousEmailId: null,
    composeOptions: { mode: 'new' as const, originalEmail: null }
  })),

  openSidebar: () => set({ isSidebarOpen: true }),
  closeSidebar: () => set({ isSidebarOpen: false }),
  toggleSidebar: () => set({ isSidebarOpen: !get().isSidebarOpen }),

  isSidebarCollapsed: false,
  toggleSidebarCollapsed: () => set({ isSidebarCollapsed: !get().isSidebarCollapsed }),

  searchFocusToken: 0,
  focusSearch: () => set({ searchFocusToken: get().searchFocusToken + 1 }),

  language: 'system',
  locale: 'en',
  setLanguage(language) {
    try {
      if (language === 'system') localStorage.removeItem('language');
      else localStorage.setItem('language', language);
    } catch {}
    const locale = resolveLocale(language);
    syncParaglideLocale(locale);
    set({ language, locale });
  },
  initLocale() {
    const language = storedLanguage();
    const locale = resolveLocale(language);
    syncParaglideLocale(locale);
    set({ language, locale });
  },

  openComposeModal: (options) => set({
    composeOptions: options || { mode: 'new', originalEmail: null },
    isComposeModalOpen: true
  }),

  closeComposeModal: () => set({
    isComposeModalOpen: false,
    composeOptions: { mode: 'new', originalEmail: null }
  })
}));

if (typeof window !== 'undefined') {
  overwriteGetLocale(() => useUIStore.getState().locale);
}

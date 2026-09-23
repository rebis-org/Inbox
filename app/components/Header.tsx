import { useLocation, useNavigate, useParams } from '@tanstack/react-router';
import { ListIcon, PanelLeftIcon, SearchIcon, SettingsIcon, XIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import Theme from '~/components/Theme';
import { Button } from '~/components/ui/button';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from '~/components/ui/input-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip';
import { useUIStore } from '~/hooks/store';
import { m } from '~/paraglide/messages';

export default function Header() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const { mailboxId } = useParams({ from: '/mailbox/$mailboxId' });
  const navigate = useNavigate();
  const location = useLocation();
  const { toggleSidebar, toggleSidebarCollapsed, searchFocusToken } = useUIStore();
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [focusedToken, setFocusedToken] = useState(searchFocusToken);
  if (focusedToken !== searchFocusToken) {
    setFocusedToken(searchFocusToken);
    setIsSearchExpanded(true);
  }
  useEffect(() => {
    if (focusedToken > 0) searchRef.current?.focus();
  }, [focusedToken]);

  const urlQuery = new URLSearchParams(location.searchStr).get('q') ?? '';
  const [previousUrlQuery, setPreviousUrlQuery] = useState<string | undefined>();
  if (previousUrlQuery !== urlQuery) {
    setPreviousUrlQuery(urlQuery);
    if (urlQuery && location.pathname.includes('/search')) {
      setSearchQuery(urlQuery);
    }
  }

  const performSearch = () => {
    if (mailboxId && searchQuery.trim()) {
      const q = searchQuery.trim();
      navigate({
        to: '/mailbox/$mailboxId/search',
        params: { mailboxId },
        search: { q }
      });
      setIsSearchExpanded(false);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    if (mailboxId && location.pathname.includes('/search')) {
      navigate({
        to: '/mailbox/$mailboxId/emails/$folder',
        params: { mailboxId, folder: 'inbox' }
      });
    }
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      performSearch();
    }
    if (e.key === 'Escape') {
      if (searchQuery) {
        clearSearch();
      } else {
        setIsSearchExpanded(false);
      }
    }
  };

  const isSettingsActive = location.pathname.includes('/settings');

  return (
    <header className="flex items-center gap-2 px-4 py-2.5 bg-background border-b border-border sticky top-0 z-10 md:px-6 md:gap-4">
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={toggleSidebar}
        aria-label={m.navToggleSidebar()}
        className="md:hidden shrink-0"
      >
        <ListIcon />
      </Button>

      <div
        className={`flex-1 max-w-lg transition-all flex items-center gap-1 ${
          isSearchExpanded ? 'flex' : 'hidden md:flex'
        }`}
      >
        <div className="flex-1">
          <InputGroup>
            <InputGroupInput
              ref={searchRef}
              aria-label={m.searchAria()}
              placeholder={m.searchPlaceholder()}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {searchQuery && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton size="icon-xs" onClick={clearSearch} aria-label={m.searchClear()}>
                  <XIcon />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
        </div>
        <Tooltip>
          <TooltipTrigger render={
            <Button variant="ghost" size="icon-sm" onClick={performSearch} aria-label={m.searchSubmit()} />
          }
          >
            <SearchIcon />
          </TooltipTrigger>
          <TooltipContent side="bottom">{m.searchSubmit()}</TooltipContent>
        </Tooltip>
      </div>

      {!isSearchExpanded && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setIsSearchExpanded(true)}
          aria-label={m.searchSubmit()}
          className="md:hidden shrink-0"
        >
          <SearchIcon />
        </Button>
      )}

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={toggleSidebarCollapsed}
        aria-label={m.navCollapseSidebar()}
        className="hidden md:inline-flex shrink-0"
      >
        <PanelLeftIcon />
      </Button>

      <div className="flex items-center gap-1 ml-auto shrink-0">
        <Theme />
        <Tooltip>
          <TooltipTrigger render={
            <Button
              variant={isSettingsActive ? 'secondary' : 'ghost'}
              size="icon-sm"
              onClick={() => navigate(
                isSettingsActive
                  ? {
                    to: '/mailbox/$mailboxId/emails/$folder',
                    params: { mailboxId, folder: 'inbox' }
                  }
                  : {
                    to: '/mailbox/$mailboxId/settings',
                    params: { mailboxId }
                  }
              )}
              aria-label={m.navSettings()}
            />
          }
          >
            <SettingsIcon />
          </TooltipTrigger>
          <TooltipContent side="bottom">{m.navSettings()}</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}

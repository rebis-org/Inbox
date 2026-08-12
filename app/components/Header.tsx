import { useLocation, useNavigate, useParams } from '@tanstack/react-router';
import { ListIcon, SearchIcon, SettingsIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Button } from '~/components/ui/button';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from '~/components/ui/input-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip';
import { useUIStore } from '~/hooks/useUIStore';

export default function Header() {
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const { mailboxId } = useParams({ from: '/mailbox/$mailboxId' });
  const navigate = useNavigate();
  const location = useLocation();
  const { toggleSidebar } = useUIStore();

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
        aria-label="Toggle sidebar"
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
              aria-label="Search emails"
              placeholder="Search emails... (try from:name, is:unread, has:attachment)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            {searchQuery && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton size="icon-xs" onClick={clearSearch} aria-label="Clear search">
                  <XIcon />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
        </div>
        <Tooltip>
          <TooltipTrigger render={
            <Button variant="ghost" size="icon-sm" onClick={performSearch} aria-label="Search" />
          }
          >
            <SearchIcon />
          </TooltipTrigger>
          <TooltipContent side="bottom">Search</TooltipContent>
        </Tooltip>
      </div>

      {!isSearchExpanded && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setIsSearchExpanded(true)}
          aria-label="Search"
          className="md:hidden shrink-0"
        >
          <SearchIcon />
        </Button>
      )}

      <div className="flex items-center gap-1 ml-auto shrink-0">
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
              aria-label="Settings"
            />
          }
          >
            <SettingsIcon />
          </TooltipTrigger>
          <TooltipContent side="bottom">Settings</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
}

import { falseFn, noop, trueFn } from 'foxts/noop';
import { MoonIcon, SunIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';
import { Button } from '~/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '~/components/ui/tooltip';
import { m } from '~/paraglide/messages';

const subscribeNoop = () => noop;

export default function Theme() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribeNoop, trueFn, falseFn);
  const dark = mounted && resolvedTheme === 'dark';

  return (
    <Tooltip>
      <TooltipTrigger render={
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setTheme(dark ? 'light' : 'dark')}
          aria-label={dark ? m.themeToLight() : m.themeToDark()}
        />
      }
      >
        {dark ? <SunIcon /> : <MoonIcon />}
      </TooltipTrigger>
      <TooltipContent side="bottom">{dark ? m.themeLight() : m.themeDark()}</TooltipContent>
    </Tooltip>
  );
}

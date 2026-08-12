import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRootRoute, HeadContent, Outlet, Scripts, useNavigate } from '@tanstack/react-router';
import { TriangleAlertIcon } from 'lucide-react';
import { useState } from 'react';
import { Button } from '~/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle
} from '~/components/ui/empty';
import { Toaster } from '~/components/ui/toast';
import { Spinner } from '~/components/ui/spinner';
import { TooltipProvider } from '~/components/ui/tooltip';
import { ApiError } from '~/services/api';
import '../index.css';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30000,
        refetchOnWindowFocus: false,
        retry(failureCount, error) {
          if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
            return false;
          }
          return failureCount < 2;
        }
      }
    },
    mutationCache: new MutationCache({
      onError(error) {
        // eslint-disable-next-line no-console
        console.error('Mutation failed:', error);
      }
    })
  });
}

let browserQueryClient: QueryClient | undefined;
function getQueryClient() {
  if (typeof window === 'undefined') {
    return makeQueryClient();
  }
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'UTF-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1.0' },
      { title: 'Inbox' }
    ],
    links: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }]
  }),
  component: RootComponent,
  errorComponent: RootErrorBoundary,
  notFoundComponent: NotFoundComponent,
  pendingComponent: () => (
    <div className="flex items-center justify-center h-screen">
      <Spinner className="size-8" />
    </div>
  )
});

function RootDocument({ children }: React.PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="bg-background text-foreground antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  // eslint-disable-next-line vibe-proof/react-no-use-state-as-ref
  const [queryClient] = useState(getQueryClient);
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <RootDocument>
          <Outlet />
        </RootDocument>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

function NotFoundComponent() {
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Empty>
        <EmptyMedia variant="icon">
          <TriangleAlertIcon className="text-muted-foreground" />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>404 -- Page Not Found</EmptyTitle>
          <EmptyDescription>The page you're looking for doesn't exist.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="default" size="sm" onClick={() => navigate({ to: '/' })}>
            Go Home
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}

function RootErrorBoundary({ error }: { error: unknown }) {
  const navigate = useNavigate();
  const title = 'Something went wrong';
  let description = 'An unexpected error occurred. Please try again.';

  if (error instanceof Error && import.meta.env.DEV) {
    description = error.message;
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-8">
      <Empty>
        <EmptyMedia variant="icon">
          <TriangleAlertIcon className="text-muted-foreground" />
        </EmptyMedia>
        <EmptyHeader>
          <EmptyTitle>{title}</EmptyTitle>
          <EmptyDescription>{description}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button
            variant="default"
            onClick={() => {
              navigate({ to: '/' });
            }}
          >
            Go Home
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  );
}

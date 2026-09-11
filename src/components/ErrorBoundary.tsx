import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertIcon } from './ui/Icons';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * Last-resort UI so a rendering failure shows an explanation instead of a
 * blank page. Nothing is reported anywhere — the message stays on screen.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('ASCII Motion crashed:', error, info.componentStack);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex min-h-full items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-[14px] border border-destructive/35 bg-destructive/10 p-6">
          <AlertIcon width={22} height={22} className="text-destructive" />
          <h1 className="pt-4 text-[18px]">Something went wrong</h1>
          <p className="pt-2 text-[13.5px] leading-relaxed text-muted-foreground">
            The editor hit an unexpected error and stopped. Reloading the page clears everything
            and starts fresh.
          </p>
          <p className="mt-4 overflow-x-auto rounded-[8px] border border-border bg-background px-3 py-2 font-mono text-[11.5px] text-fg-dim">
            {error.message || String(error)}
          </p>
          <div className="pt-5">
            <Button onClick={() => window.location.reload()} className="w-full">
              Reload ASCII Motion
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

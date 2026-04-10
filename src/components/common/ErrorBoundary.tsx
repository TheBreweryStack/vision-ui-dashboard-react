import { Component, type ReactNode } from 'react';
import { logger } from '@/lib/logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logger.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex min-h-screen items-center justify-center bg-[#080a0f] p-6">
          <div className="mx-auto max-w-md text-center">
            <div className="mb-4 text-4xl">⚠️</div>
            <h1 className="mb-2 text-xl font-semibold text-white">
              Something went wrong
            </h1>
            <p className="mb-6 text-sm text-gray-400">
              The app encountered an unexpected error. You can try again or
              reload the page.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={this.handleReset}
                className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10"
              >
                Try again
              </button>
              <button
                onClick={this.handleReload}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white transition hover:bg-blue-500"
              >
                Reload app
              </button>
            </div>
            {this.state.error && (
              <details className="mt-6 text-left">
                <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-400">
                  Error details
                </summary>
                <pre className="mt-2 max-h-40 overflow-auto rounded bg-white/5 p-3 text-xs text-red-400">
                  {this.state.error.message}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

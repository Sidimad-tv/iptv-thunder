import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error: error instanceof Error ? error : new Error(String(error)), errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    
    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
    
    // TODO: Integrate with error tracking service (Sentry, LogRocket, etc.)
    // errorTrackingService.logError(error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      const isDev = import.meta.env.DEV ?? false;
      const error = this.state.error;
      const errorInfo = this.state.errorInfo;

      return (
        <div className="h-full w-full flex items-center justify-center bg-slate-900" role="alert" aria-live="assertive">
          <div className="text-center p-8 max-w-2xl">
            <h1 className="text-2xl font-bold text-white mb-4">Something went wrong</h1>
            <p className="text-slate-400 mb-6">{error?.message || 'An unexpected error occurred'}</p>
            
            {isDev && error && (
              <details className="mb-6 text-left">
                <summary className="cursor-pointer text-slate-300 hover:text-white mb-2">Error Details</summary>
                <pre className="bg-slate-800 p-4 rounded-lg overflow-auto text-sm text-slate-300">
                  <strong>Error:</strong> {error.stack || 'No stack trace available'}
                  {errorInfo && (
                    <>
                      {'\n\n'}
                      <strong>Component Stack:</strong>
                      {errorInfo.componentStack}
                    </>
                  )}
                </pre>
              </details>
            )}
            
            <div className="flex gap-4 justify-center">
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600 transition"
                aria-label="Try again"
              >
                Try Again
              </button>
              <button
                onClick={() => globalThis.location.reload()}
                className="px-4 py-2 bg-green-700 text-white rounded-lg hover:bg-green-800 transition"
                aria-label="Reload the page"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

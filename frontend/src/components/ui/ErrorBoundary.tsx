'use client';

import { Component, ErrorInfo, ReactNode } from 'react';
import { useTranslations } from 'next-intl';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface InnerProps extends Props {
  title: string;
  retryLabel: string;
  unexpectedMessage: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class ErrorBoundaryInner extends Component<InnerProps, State> {
  constructor(props: InnerProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center min-h-[40vh] p-8 text-center">
          <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-6 max-w-md">
            <h2 className="text-lg font-semibold text-red-700 dark:text-red-400 mb-2">
              {this.props.title}
            </h2>
            <p className="text-sm text-red-600 dark:text-red-300 mb-4">
              {this.state.error?.message || this.props.unexpectedMessage}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: undefined })}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
            >
              {this.props.retryLabel}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/** Les composants de classe ne peuvent pas utiliser les hooks : les libellés traduits sont passés en props. */
export default function ErrorBoundary({ children, fallback }: Props) {
  const tErrors = useTranslations('errors');
  const tCommon = useTranslations('common');
  return (
    <ErrorBoundaryInner
      fallback={fallback}
      title={tErrors('errorTitle')}
      retryLabel={tCommon('retry')}
      unexpectedMessage={tCommon('unexpectedError')}
    >
      {children}
    </ErrorBoundaryInner>
  );
}

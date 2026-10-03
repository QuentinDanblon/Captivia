'use client';

import { Component, ErrorInfo, ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import Button from './Button';

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

      // Message technique jamais affiché (même règle que `[locale]/error.tsx`) : constat, une action.
      return (
        <div role="alert" className="mx-auto my-8 grid max-w-xl gap-3 rounded-card border border-dashed border-line-strong px-6 py-8 shadow-[inset_3px_0_0_var(--danger)]">
          <h2 className="m-0 text-h3 text-ink">{this.props.title}</h2>
          <p className="m-0 text-body text-ink-2">{this.props.unexpectedMessage}</p>
          <div className="pt-1">
            <Button variant="secondary" size="sm" onClick={() => this.setState({ hasError: false, error: undefined })}>
              {this.props.retryLabel}
            </Button>
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

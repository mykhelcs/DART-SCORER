import { Component, ErrorInfo, ReactNode } from 'react';
import { clearCurrentMatch } from '../services/storage';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in application:', error, errorInfo);
  }

  private handleReset = () => {
    clearCurrentMatch();
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ maxWidth: '600px', margin: '10vh auto', padding: '30px', textAlign: 'center' }} className="card-panel">
          <h2 style={{ color: 'var(--red)', fontSize: '2.5rem', margin: '0 0 12px' }}>Something went wrong</h2>
          <p style={{ color: 'var(--muted)', marginBottom: '24px' }}>
            An unexpected error occurred while rendering the page. You can restore default state below:
          </p>
          <div style={{ background: 'var(--ink)', padding: '12px', borderRadius: '8px', color: '#ff857a', fontFamily: 'monospace', marginBottom: '24px', textAlign: 'left', overflowX: 'auto' }}>
            {this.state.error?.message || 'Unknown error'}
          </div>
          <button className="btn pri" onClick={this.handleReset}>
            Reset Match & Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

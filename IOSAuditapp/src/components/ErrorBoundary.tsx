import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100vh',
            padding: '20px',
            backgroundColor: '#fefefe',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚠️</div>
          <h1 style={{ fontSize: '24px', marginBottom: '10px', color: '#333' }}>
            Đã xảy ra lỗi
          </h1>
          <p style={{ fontSize: '16px', color: '#666', textAlign: 'center', marginBottom: '20px' }}>
            {this.state.error?.message || 'Có lỗi xảy ra trong ứng dụng'}
          </p>
          <button
            onClick={() => {
              window.location.reload();
            }}
            style={{
              padding: '12px 24px',
              backgroundColor: '#0138C3',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '16px',
              cursor: 'pointer',
            }}
          >
            Tải lại trang
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;


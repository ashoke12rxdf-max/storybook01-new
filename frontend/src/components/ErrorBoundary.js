import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#1C2340',
          padding: '20px'
        }}>
          <div style={{
            background: 'white',
            padding: '40px',
            borderRadius: '16px',
            maxWidth: '600px',
            width: '100%',
            textAlign: 'center',
            boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
          }}>
            <h1 style={{ 
              color: '#1C2340', 
              marginBottom: '16px',
              fontSize: '24px',
              fontFamily: 'Georgia, serif'
            }}>
              Something went wrong
            </h1>
            <p style={{ 
              color: '#666', 
              marginBottom: '24px',
              fontSize: '14px'
            }}>
              The application encountered an unexpected error. Please try refreshing the page.
            </p>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details style={{ 
                textAlign: 'left', 
                marginBottom: '24px',
                background: '#f5f5f5',
                padding: '16px',
                borderRadius: '8px',
                fontSize: '12px'
              }}>
                <summary style={{ cursor: 'pointer', fontWeight: 'bold', marginBottom: '8px' }}>
                  Error Details
                </summary>
                <pre style={{ 
                  whiteSpace: 'pre-wrap', 
                  wordBreak: 'break-word',
                  color: '#c00'
                }}>
                  {this.state.error.toString()}
                </pre>
                {this.state.errorInfo && (
                  <pre style={{ 
                    whiteSpace: 'pre-wrap', 
                    wordBreak: 'break-word',
                    marginTop: '8px',
                    color: '#666'
                  }}>
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </details>
            )}

            <div style={{ 
              background: '#fff3cd', 
              border: '1px solid #ffc107',
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '24px',
              fontSize: '13px',
              color: '#856404'
            }}>
              <strong>Debug Info:</strong><br/>
              Backend URL: {process.env.REACT_APP_BACKEND_URL || 'NOT SET'}<br/>
              Environment: {process.env.NODE_ENV}
            </div>
            
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#1C2340',
                color: 'white',
                border: 'none',
                padding: '12px 32px',
                borderRadius: '24px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500'
              }}
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

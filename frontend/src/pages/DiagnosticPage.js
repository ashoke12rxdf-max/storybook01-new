import React, { useState, useEffect, useCallback } from 'react';

const DiagnosticPage = () => {
  const [backendStatus, setBackendStatus] = useState('Checking...');
  const [apiResponse, setApiResponse] = useState(null);
  const [error, setError] = useState(null);

  const backendUrl = process.env.REACT_APP_BACKEND_URL || 'NOT SET';

  const checkBackend = useCallback(async () => {
    try {
      const url = `${backendUrl}/api/`;
      setBackendStatus(`Fetching ${url}...`);
      
      const response = await fetch(url, { 
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      });
      
      if (response.ok) {
        const data = await response.json();
        setBackendStatus('Connected!');
        setApiResponse(data);
      } else {
        setBackendStatus(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      setBackendStatus('Failed to connect');
      setError(err.message);
    }
  }, [backendUrl]);

  useEffect(() => {
    checkBackend();
  }, [checkBackend]);

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#1C2340',
      color: 'white',
      padding: '40px',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '8px' }}>Storybook Vault - Diagnostic Page</h1>
        <p style={{ color: '#888', marginBottom: '32px' }}>
          Use this page to debug deployment issues
        </p>

        <div style={{
          background: '#2a3550',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <h2 style={{ marginBottom: '16px', fontSize: '18px' }}>Environment Variables</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ padding: '8px 0', color: '#888' }}>REACT_APP_BACKEND_URL</td>
                <td style={{ 
                  padding: '8px 0', 
                  fontFamily: 'monospace',
                  color: backendUrl === 'NOT SET' ? '#ff6b6b' : '#51cf66'
                }}>
                  {backendUrl}
                </td>
              </tr>
              <tr>
                <td style={{ padding: '8px 0', color: '#888' }}>NODE_ENV</td>
                <td style={{ padding: '8px 0', fontFamily: 'monospace' }}>
                  {process.env.NODE_ENV}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div style={{
          background: '#2a3550',
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px'
        }}>
          <h2 style={{ marginBottom: '16px', fontSize: '18px' }}>Backend Connection Test</h2>
          <div style={{ marginBottom: '16px' }}>
            <span style={{ color: '#888' }}>Status: </span>
            <span style={{
              color: backendStatus === 'Connected!' ? '#51cf66' : 
                     backendStatus.includes('Failed') ? '#ff6b6b' : '#ffd43b'
            }}>
              {backendStatus}
            </span>
          </div>
          
          {apiResponse && (
            <div style={{ 
              background: '#1a2235', 
              padding: '12px', 
              borderRadius: '8px',
              fontFamily: 'monospace',
              fontSize: '14px'
            }}>
              {JSON.stringify(apiResponse, null, 2)}
            </div>
          )}
          
          {error && (
            <div style={{ 
              background: '#4a1a1a', 
              padding: '12px', 
              borderRadius: '8px',
              color: '#ff6b6b',
              fontSize: '14px'
            }}>
              Error: {error}
            </div>
          )}

          <button
            onClick={checkBackend}
            style={{
              marginTop: '16px',
              background: '#4dabf7',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '8px',
              cursor: 'pointer'
            }}
          >
            Retry Connection
          </button>
        </div>

        <div style={{
          background: '#2a3550',
          borderRadius: '12px',
          padding: '24px'
        }}>
          <h2 style={{ marginBottom: '16px', fontSize: '18px' }}>Setup Instructions</h2>
          <ol style={{ lineHeight: '2', paddingLeft: '20px' }}>
            <li>Go to your Railway frontend service</li>
            <li>Click on the <strong>Variables</strong> tab</li>
            <li>Add: <code style={{ background: '#1a2235', padding: '2px 8px', borderRadius: '4px' }}>
              REACT_APP_BACKEND_URL = https://storybook-vault-production.up.railway.app
            </code></li>
            <li>Click <strong>Deploy</strong> or trigger a new deployment</li>
            <li>Wait for the build to complete</li>
            <li>Refresh this page to verify the connection</li>
          </ol>
        </div>

        <div style={{ marginTop: '24px', textAlign: 'center' }}>
          <a 
            href="/" 
            style={{ 
              color: '#4dabf7', 
              textDecoration: 'none',
              display: 'inline-block',
              padding: '12px 24px',
              border: '1px solid #4dabf7',
              borderRadius: '8px'
            }}
          >
            Go to App Home
          </a>
        </div>
      </div>
    </div>
  );
};

export default DiagnosticPage;

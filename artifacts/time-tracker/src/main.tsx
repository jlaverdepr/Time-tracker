import { createRoot } from 'react-dom/client';
import * as React from 'react';
import { setAuthTokenGetter } from '@workspace/api-client-react';

import App from './App';

import './index.css';

const TOKEN_STORAGE_KEY = 'focustime.token';

// The desktop app passes the token via ?token=... the first time it points
// this window at the server (see desktop/src/main.ts) — pick it up once,
// persist it like a normal browser session, and clean it out of the URL.
// Resolved at module load, before the first render, so even the very first
// request any component fires already carries the auth header — a
// useEffect here would run after App's own query hooks have already fired
// on mount and lose that race.
function resolveStoredToken(): string | null {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get('token');
  if (fromUrl) {
    localStorage.setItem(TOKEN_STORAGE_KEY, fromUrl);
    window.history.replaceState({}, '', window.location.pathname);
    return fromUrl;
  }
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

const initialToken = resolveStoredToken();
if (initialToken) setAuthTokenGetter(() => initialToken);

async function tokenIsValid(token: string): Promise<boolean> {
  try {
    const res = await fetch('/api/projects', { headers: { Authorization: `Bearer ${token}` } });
    return res.ok;
  } catch {
    return false;
  }
}

function ConnectGate({ onConnected }: { onConnected: () => void }) {
  const [token, setToken] = React.useState('');
  const [checking, setChecking] = React.useState(false);
  const [error, setError] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = token.trim();
    if (!trimmed) return;
    setChecking(true);
    setError(false);
    const ok = await tokenIsValid(trimmed);
    if (!ok) {
      setChecking(false);
      setError(true);
      return;
    }
    localStorage.setItem(TOKEN_STORAGE_KEY, trimmed);
    setAuthTokenGetter(() => trimmed);
    onConnected();
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#fbfaf9', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    }}>
      <form onSubmit={handleSubmit} style={{
        width: 360, padding: 28, borderRadius: 16, background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.06)',
      }}>
        <h1 style={{ fontSize: 18, margin: '0 0 6px', color: '#1f292e' }}>Connect FocusTime</h1>
        <p style={{ fontSize: 13, color: '#67777e', margin: '0 0 20px', lineHeight: 1.5 }}>
          Enter your access token to continue.
        </p>
        <input
          value={token}
          onChange={e => setToken(e.target.value)}
          placeholder="Access token"
          autoFocus
          spellCheck={false}
          style={{
            width: '100%', boxSizing: 'border-box', padding: '9px 10px', marginBottom: 14,
            borderRadius: 8, border: '1px solid #e8e6e3', fontSize: 14,
          }}
        />
        {error && (
          <div style={{ color: '#ef4343', fontSize: 12, margin: '-6px 0 10px' }}>
            That token didn't work — check it and try again.
          </div>
        )}
        <button
          type="submit"
          disabled={checking || !token.trim()}
          style={{
            width: '100%', padding: 10, border: 'none', borderRadius: 8,
            background: '#0d7373', color: '#fff', fontWeight: 600, fontSize: 14,
            cursor: checking || !token.trim() ? 'default' : 'pointer',
            opacity: checking || !token.trim() ? 0.5 : 1,
          }}
        >
          {checking ? 'Connecting…' : 'Connect'}
        </button>
      </form>
    </div>
  );
}

function Root() {
  const [connected, setConnected] = React.useState(!!initialToken);
  if (!connected) return <ConnectGate onConnected={() => setConnected(true)} />;
  return <App />;
}

createRoot(document.getElementById('root')!).render(<Root />);

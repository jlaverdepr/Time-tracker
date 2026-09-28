import * as React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { setBaseUrl, setAuthTokenGetter } from '@workspace/api-client-react';

// Only used by App.tsx's dev-only auto-connect (see DEV_TOKEN there) — real
// usage always goes through ConnectScreen, where the URL is whatever your
// cloud deployment's address is (see DEPLOY.md), not this LAN default.
// No "/api" suffix: every generated endpoint path already starts with
// "/api/...", so setBaseUrl() just needs the bare origin.
export const DEFAULT_API_URL = 'http://d6q4j7pdqr-mac.local:8775';

const STORAGE_URL_KEY = 'focustime.serverUrl';
const STORAGE_TOKEN_KEY = 'focustime.token';

type ConnectionContextValue = {
  url: string | null;
  token: string | null;
  isLoading: boolean;
  connect: (url: string, token: string) => void;
  disconnect: () => void;
};

const ConnectionContext = React.createContext<ConnectionContextValue | null>(null);

export function ConnectionProvider({ children }: { children: React.ReactNode }) {
  const [url, setUrl] = React.useState<string | null>(null);
  const [token, setToken] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      const [storedUrl, storedToken] = await Promise.all([
        AsyncStorage.getItem(STORAGE_URL_KEY),
        AsyncStorage.getItem(STORAGE_TOKEN_KEY),
      ]);
      if (storedUrl) {
        setBaseUrl(storedUrl);
        setUrl(storedUrl);
      }
      if (storedToken) {
        setAuthTokenGetter(() => storedToken);
        setToken(storedToken);
      }
      setIsLoading(false);
    })();
  }, []);

  const connect = React.useCallback((newUrl: string, newToken: string) => {
    setBaseUrl(newUrl);
    setAuthTokenGetter(() => newToken);
    setUrl(newUrl);
    setToken(newToken);
    AsyncStorage.setItem(STORAGE_URL_KEY, newUrl);
    AsyncStorage.setItem(STORAGE_TOKEN_KEY, newToken);
  }, []);

  const disconnect = React.useCallback(() => {
    setBaseUrl(null);
    setAuthTokenGetter(null);
    setUrl(null);
    setToken(null);
    AsyncStorage.multiRemove([STORAGE_URL_KEY, STORAGE_TOKEN_KEY]);
  }, []);

  return (
    <ConnectionContext.Provider value={{ url, token, isLoading, connect, disconnect }}>
      {children}
    </ConnectionContext.Provider>
  );
}

export function useConnection(): ConnectionContextValue {
  const ctx = React.useContext(ConnectionContext);
  if (!ctx) throw new Error('useConnection must be used within a ConnectionProvider');
  return ctx;
}

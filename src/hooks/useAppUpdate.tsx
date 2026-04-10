import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface AppUpdateContextType {
  updateAvailable: boolean;
  setUpdateAvailable: (available: boolean) => void;
  triggerUpdate: () => void;
}

const AppUpdateContext = createContext<AppUpdateContextType | undefined>(undefined);

interface AppUpdateProviderProps {
  children: ReactNode;
}

export function AppUpdateProvider({ children }: AppUpdateProviderProps) {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  const triggerUpdate = useCallback(() => {
    window.location.reload();
  }, []);

  const value = { updateAvailable, setUpdateAvailable, triggerUpdate };

  return (
    <AppUpdateContext.Provider value={value}>
      {children}
    </AppUpdateContext.Provider>
  );
}

export function useAppUpdate() {
  const context = useContext(AppUpdateContext);
  if (!context) {
    throw new Error('useAppUpdate must be used within AppUpdateProvider');
  }
  return context;
}

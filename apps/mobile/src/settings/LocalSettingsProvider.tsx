import { createContext, useContext, useMemo, useState, type PropsWithChildren } from 'react';

import { createInitialLocalSettings, type LocalAppSettings } from './defaultSettings';

type LocalSettingsContextValue = {
  settings: LocalAppSettings;
  updateSettings: (nextSettings: Partial<LocalAppSettings>) => void;
  resetSettings: () => void;
};

const LocalSettingsContext = createContext<LocalSettingsContextValue | null>(null);

export function LocalSettingsProvider({ children }: PropsWithChildren) {
  const [settings, setSettings] = useState<LocalAppSettings>(() => createInitialLocalSettings());

  const value = useMemo<LocalSettingsContextValue>(
    () => ({
      settings,
      updateSettings: (nextSettings) => {
        setSettings((currentSettings) => ({
          ...currentSettings,
          ...nextSettings,
        }));
      },
      resetSettings: () => {
        setSettings(createInitialLocalSettings());
      },
    }),
    [settings],
  );

  return <LocalSettingsContext.Provider value={value}>{children}</LocalSettingsContext.Provider>;
}

export function useLocalSettings() {
  const context = useContext(LocalSettingsContext);

  if (!context) {
    throw new Error('useLocalSettings must be used within LocalSettingsProvider');
  }

  return context;
}

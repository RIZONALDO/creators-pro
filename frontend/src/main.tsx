import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppProvider } from './context/AppProvider';
import { ToastProvider } from './context/ToastContext';
import { ConfirmProvider } from './context/ConfirmContext';
import { NotificationsProvider } from './context/NotificationsContext';
import { App } from './App';
import { PlatformApp } from './platform/PlatformApp';
import './theme.css';

// Árvore React completamente separada — sem AppContext, sem autenticação de tenant.
const isPlatform = window.location.pathname.startsWith('/platform');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isPlatform ? (
      <PlatformApp />
    ) : (
      <BrowserRouter>
        <ToastProvider>
          <ConfirmProvider>
            <AppProvider>
              <NotificationsProvider>
                <App />
              </NotificationsProvider>
            </AppProvider>
          </ConfirmProvider>
        </ToastProvider>
      </BrowserRouter>
    )}
  </StrictMode>,
);

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import { TooltipProvider } from '@/components/ui/tooltip';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('Root container is missing from index.html');

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary>
      <TooltipProvider delayDuration={350}>
        <App />
      </TooltipProvider>
    </ErrorBoundary>
  </StrictMode>,
);

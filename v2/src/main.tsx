import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// The site lives at ci-connects.org. The Pages address it started on, and
// www, send people there — before anything renders, keeping the path.
const HOME = 'ci-connects.org';
if (location.hostname === 'ci-events.pages.dev' || location.hostname === `www.${HOME}`) {
  location.replace(`https://${HOME}${location.pathname}${location.search}${location.hash}`);
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

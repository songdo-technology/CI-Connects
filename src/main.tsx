import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {DataProvider} from './lib/data/DataProvider';
import {createSeededMemoryStore} from './lib/data/seed';

// The one place the storage implementation is chosen. Swapping to Firestore is
// a change to this line and nothing else in the application.
const store = createSeededMemoryStore();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DataProvider store={store}>
      <App />
    </DataProvider>
  </StrictMode>,
);

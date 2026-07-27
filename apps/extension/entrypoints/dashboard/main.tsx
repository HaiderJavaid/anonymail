import React from 'react';
import ReactDOM from 'react-dom/client';
import { InboxApp } from '../../components/InboxApp';

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><InboxApp surface="dashboard" /></React.StrictMode>);

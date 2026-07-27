import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'Anonymail',
    description: 'Create a disposable inbox and fill signup forms without leaving the page.',
    version: '0.1.0',
    minimum_chrome_version: '116',
    permissions: ['activeTab', 'scripting', 'contextMenus', 'sidePanel', 'storage', 'alarms'],
    host_permissions: ['https://api.mail.tm/*'],
    action: {
      default_title: 'Open Anonymail',
      default_icon: {
        16: 'icons/icon-16.png',
        32: 'icons/icon-32.png',
        48: 'icons/icon-48.png',
        128: 'icons/icon-128.png'
      }
    },
    icons: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png'
    },
    side_panel: { default_path: 'sidepanel.html' }
  }
});

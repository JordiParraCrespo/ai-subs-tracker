import { consumerModules } from '@flama/frontend-consumer';
import { FlamaApp } from '@flama/frontend-core/di';
import { desktopBridge as desktop, LocalStorageService } from '@flama/frontend-web';
import { webAuthClient } from './auth-client';
// flama:plugins app-imports

export const app = FlamaApp.create({
  // Same-origin by default: the Vite dev server proxies `/api` to the API so
  // the session cookie is sent with every request. Set VITE_API_URL only when
  // the API is served from a different origin behind a shared domain in
  // production.
  apiBaseUrl: desktop?.apiUrl ?? import.meta.env.VITE_API_URL ?? '',
  storage: new LocalStorageService(),
  authClient: webAuthClient,
  // flama:plugins app-config
  modules: [
    // Loading the consumer product's modules is what makes this app that product.
    ...consumerModules,
    // flama:plugins app-modules
  ],
});

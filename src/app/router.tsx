// Routes with hash history, so any static host serves the app (ADR-010).
import { createHashHistory, createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { HomePage } from '@/ui/HomePage.tsx';
import { Root } from '@/ui/Root.tsx';
import { SettingsPage } from '@/ui/SettingsPage.tsx';

const rootRoute = createRootRoute({ component: Root });

const routeTree = rootRoute.addChildren([
  createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomePage }),
  createRoute({ getParentRoute: () => rootRoute, path: '/settings', component: SettingsPage }),
]);

export const router = createRouter({ routeTree, history: createHashHistory() });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

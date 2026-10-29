// Routes with hash history, so any static host serves the app (ADR-010). URLs hold record IDs,
// never names or search text: browsers keep URLs in history, and some sync it.
import { createHashHistory, createRootRoute, createRoute, createRouter, type RouteComponent } from '@tanstack/react-router';
import { CompaniesPage } from '@/features/companies/CompaniesPage.tsx';
import { EditCompanyPage, NewCompanyPage } from '@/features/companies/CompanyEditor.tsx';
import { CompanyPage } from '@/features/companies/CompanyPage.tsx';
import { EditContactPage, NewContactPage } from '@/features/contacts/ContactEditor.tsx';
import { ContactPage } from '@/features/contacts/ContactPage.tsx';
import { ContactsPage } from '@/features/contacts/ContactsPage.tsx';
import { HomePage } from '@/ui/HomePage.tsx';
import { Root } from '@/ui/Root.tsx';
import { SettingsPage } from '@/ui/SettingsPage.tsx';

const rootRoute = createRootRoute({ component: Root });
const page = <P extends string>(path: P, component: RouteComponent) => createRoute({ getParentRoute: () => rootRoute, path, component });

const routeTree = rootRoute.addChildren([
  page('/', HomePage),
  page('/contacts', ContactsPage),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/contacts/new',
    component: NewContactPage,
    // "Add contact" on a company page fills in the company.
    validateSearch: (search: Record<string, unknown>): { companyId?: string } => (typeof search.companyId === 'string' ? { companyId: search.companyId } : {}),
  }),
  page('/contacts/$contactId', ContactPage),
  page('/contacts/$contactId/edit', EditContactPage),
  page('/companies', CompaniesPage),
  page('/companies/new', NewCompanyPage),
  page('/companies/$companyId', CompanyPage),
  page('/companies/$companyId/edit', EditCompanyPage),
  page('/settings', SettingsPage),
]);

// A page for another record starts fresh, with no form or message left from the last one.
export const router = createRouter({ routeTree, history: createHashHistory(), defaultRemountDeps: ({ params }) => params });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

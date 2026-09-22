import { DiamondBackground } from "@/components/background/DiamondBackground";
import { AppFooter } from "@/components/layout/AppFooter";
import { AppHeader } from "@/components/layout/AppHeader";
import { Toaster } from "@/components/ui/sonner";
import { DataModeProvider } from "@/hooks/use-data-mode";
import { AdminPage } from "@/pages/AdminPage";
import { HomePage } from "@/pages/HomePage";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";

const queryClient = new QueryClient();

function RootLayout() {
  return (
    <DataModeProvider>
      <div className="relative flex min-h-screen flex-col">
        <DiamondBackground />
        <AppHeader />
        <main className="flex-1">
          <Outlet />
        </main>
        <AppFooter />
        <Toaster position="bottom-right" />
      </div>
    </DataModeProvider>
  );
}

const rootRoute = createRootRoute({ component: RootLayout });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: HomePage,
});

/**
 * The admin route is reachable by any signed-in principal: a principal with no
 * role yet needs it to claim the register's first administrator seat. The page
 * itself gates every admin-only section, and prompts a signed-out visitor to
 * sign in rather than hiding the route.
 */
const adminRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/admin",
  component: AdminPage,
});

const routeTree = rootRoute.addChildren([indexRoute, adminRoute]);

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
}

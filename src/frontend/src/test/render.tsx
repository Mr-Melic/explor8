import { DataModeProvider } from "@/hooks/use-data-mode";
import type { MockActor } from "@/test/mock-actor";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { type RenderResult, render } from "@testing-library/react";
import type { ReactElement, ReactNode } from "react";
import { vi } from "vitest";

/**
 * The identity the mocked `useInternetIdentity` reports. `null` means a
 * logged-out guest; a string is a signed-in principal.
 */
export interface MockIdentity {
  principal: string | null;
}

export interface RenderOptions {
  actor: MockActor;
  identity?: MockIdentity;
  /** Extra methods to expose from the mocked core-infrastructure module. */
  login?: () => void;
  clear?: () => void;
}

/**
 * Install the module mocks the app's hooks depend on.
 *
 * `@caffeineai/core-infrastructure` owns the actor lifecycle and the Internet
 * Identity session; both are replaced with local, typed stand-ins so a test
 * exercises the app's own components and hooks without a canister or a browser
 * identity. `@caffeineai/object-storage` is replaced because the upload path
 * would otherwise reach the platform gateway.
 *
 * Must be called before the component under test is imported, so callers use
 * `vi.mock` at module scope and this helper only supplies the return values.
 */
export function mockCoreInfrastructure(options: RenderOptions) {
  const identity = options.identity ?? { principal: null };

  return {
    useActor: () => ({ actor: options.actor, isFetching: false }),
    useInternetIdentity: () => {
      // Read the principal at call time, not at mock-factory time: a test that
      // flips `identity.principal` after the module mock is installed must see
      // the signed-in branch on the next render.
      const isAuthenticated = identity.principal !== null;
      return {
        identity: isAuthenticated
          ? { getPrincipal: () => ({ toString: () => identity.principal }) }
          : undefined,
        login: options.login ?? vi.fn(),
        clear: options.clear ?? vi.fn(),
        loginStatus: isAuthenticated ? "success" : "idle",
        isInitializing: false,
        isLoginIdle: !isAuthenticated,
        isLoggingIn: false,
        isLoginSuccess: isAuthenticated,
        isLoginError: false,
        isAuthenticated,
      };
    },
    loadConfig: async () => ({
      backend_host: "http://localhost:4943",
      bucket_name: "test-bucket",
      storage_gateway_url: "http://localhost:8080",
      backend_canister_id: "aaaaa-aa",
      project_id: "test-project",
    }),
  };
}

/** A fresh QueryClient per render so no cache leaks between tests. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

export function renderWithProviders(
  ui: ReactElement,
  queryClient: QueryClient = createTestQueryClient(),
): RenderResult & { queryClient: QueryClient } {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <DataModeProvider>{children}</DataModeProvider>
      </QueryClientProvider>
    );
  }
  // Assign onto the render result rather than spreading it: a spread drops the
  // bound query methods from the inferred type, so the intersection no longer
  // satisfies `RenderResult`.
  const result = render(ui, { wrapper: Wrapper });
  return Object.assign(result, { queryClient });
}

/**
 * Render a page that uses TanStack Router's `<Link>`/`useRouterState`.
 *
 * A bare `render` leaves the router context null, so any `<Link>` throws
 * `Cannot read properties of null (reading '__store')`. This builds a minimal
 * memory-history router whose root route renders the component under test, so
 * the page sees a real router without booting the app's own route tree.
 */
export function renderWithRouter(
  ui: ReactElement,
  initialPath = "/",
  queryClient: QueryClient = createTestQueryClient(),
): RenderResult & { queryClient: QueryClient } {
  const rootRoute = createRootRoute({ component: () => <Outlet /> });
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/",
    component: () => ui,
  });
  const adminRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: "/admin",
    component: () => ui,
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute, adminRoute]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });

  function Wrapper() {
    return (
      <QueryClientProvider client={queryClient}>
        <DataModeProvider>
          <RouterProvider router={router} />
        </DataModeProvider>
      </QueryClientProvider>
    );
  }

  const result = render(<Wrapper />);
  return Object.assign(result, { queryClient });
}

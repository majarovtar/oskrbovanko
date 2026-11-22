import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it.each([
    ["/zdravnik", "/zdravnik/"],
    ["/skrbnik", "/skrbnik/"],
    ["/pacient", "/pacient/"],
    ["/auth", "/auth"],
    ["/zdravnik/pacienti", "/zdravnik/pacienti"],
    ["/zdravnik/pacienti/p1", "/zdravnik/pacienti_/$patientId"],
    ["/zdravnik/pacient/p1", "/zdravnik/pacient/$id"],
    ["/zdravnik/opozorila", "/zdravnik/opozorila"],
    ["/zdravnik/klici", "/zdravnik/klici"],
    ["/skrbnik/klici", "/skrbnik/klici"],
    ["/skrbnik/obvestila", "/skrbnik/obvestila"],
    ["/skrbnik/kontakti", "/skrbnik/kontakti"],
    ["/pacient/klici", "/pacient/klici"],
    ["/pacient/pomoc", "/pacient/pomoc"],
  ])("matches %s to its intended page", (path, routeId) => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });
    expect(router.matchRoutes(path).at(-1)?.routeId).toBe(routeId);
  });
});

// Share lazy-route loading promises with navigation prefetching. Importing
// this module does not import any page or the Aladin Lite runtime eagerly.
export function createCachedPageLoader<T>(
  load: () => Promise<T>,
): () => Promise<T> {
  let cached: Promise<T> | null = null;
  return () => {
    if (cached !== null) return cached;
    const request = load();
    cached = request;
    // A failed speculative request must not permanently poison retries.
    void request.catch(() => {
      if (cached === request) cached = null;
    });
    return request;
  };
}

// Prefetching is best-effort: a failed hint must not raise an unhandled
// rejection or break the page currently displayed.
export async function preloadPage<T>(load: () => Promise<T>): Promise<void> {
  try {
    await load();
  } catch {
    // This is a hint only; navigation retains normal module-load errors.
  }
}

export const loadObjectsPage = createCachedPageLoader(() =>
  import("./pages/ObjectsPage.tsx").then((module) => ({
    default: module.ObjectsPage,
  })),
);
export const loadObjectPage = createCachedPageLoader(() =>
  import("./pages/ObjectPage.tsx").then((module) => ({
    default: module.ObjectPage,
  })),
);
export const loadGroupsPage = createCachedPageLoader(() =>
  import("./pages/GroupsPage.tsx").then((module) => ({
    default: module.GroupsPage,
  })),
);
export const loadGroupPreviewBuilderPage = createCachedPageLoader(() =>
  import("./pages/GroupPreviewBuilderPage.tsx").then((module) => ({
    default: module.GroupPreviewBuilderPage,
  })),
);
export const loadGroupPage = createCachedPageLoader(() =>
  import("./pages/GroupPage.tsx").then((module) => ({
    default: module.GroupPage,
  })),
);
export const loadPublicationsPage = createCachedPageLoader(() =>
  import("./pages/PublicationsPage.tsx").then((module) => ({
    default: module.PublicationsPage,
  })),
);
export const loadAcknowledgementsPage = createCachedPageLoader(() =>
  import("./pages/AcknowledgementsPage.tsx").then((module) => ({
    default: module.AcknowledgementsPage,
  })),
);

export const loadDocumentsPage = createCachedPageLoader(() =>
  import("./pages/DocumentsPage.tsx").then((module) => ({
    default: module.DocumentsPage,
  })),
);

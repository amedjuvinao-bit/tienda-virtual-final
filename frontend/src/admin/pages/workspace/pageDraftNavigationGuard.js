let installed = false;
let activeGuard = null;

// Window popstate listeners run in registration order. Install before the router
// so a cancelled navigation cannot schedule an editor unmount first.
export function installPageDraftNavigationGuard() {
  if (installed) return;
  installed = true;
  window.addEventListener("popstate", (event) => activeGuard?.(event), true);
}

export function registerPageDraftNavigationGuard(guard) {
  activeGuard = guard;
  return () => {
    if (activeGuard === guard) activeGuard = null;
  };
}

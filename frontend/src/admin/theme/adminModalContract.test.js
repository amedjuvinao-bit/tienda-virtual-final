import { afterEach, describe, expect, it } from 'vitest';

import {
  installAdminModalContract,
  refreshAdminModalContract,
} from './adminModalContract';

function createViewportOverlay() {
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  document.body.appendChild(overlay);
  return overlay;
}

describe('admin modal visual contract', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    delete document.documentElement.dataset.adminRouteActive;
  });

  it('identifies an overlay that owns the dialog role and its content surface', () => {
    const overlay = createViewportOverlay();
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.style.position = 'absolute';
    const surface = document.createElement('section');
    surface.className = 'finance-modal-card';
    overlay.append(backdrop, surface);

    refreshAdminModalContract();

    expect(overlay).toHaveAttribute('data-admin-modal-overlay', 'true');
    expect(surface).toHaveAttribute('data-admin-modal-surface', 'true');
    expect(backdrop).not.toHaveAttribute('data-admin-modal-surface');
  });

  it('identifies a nested semantic dialog without changing an embedded dialog', () => {
    const overlay = createViewportOverlay();
    const surface = document.createElement('aside');
    surface.setAttribute('role', 'dialog');
    surface.setAttribute('aria-modal', 'true');
    overlay.appendChild(surface);

    const embedded = document.createElement('section');
    embedded.setAttribute('role', 'dialog');
    embedded.setAttribute('aria-modal', 'true');
    document.body.appendChild(embedded);

    refreshAdminModalContract();

    expect(overlay).toHaveAttribute('data-admin-modal-overlay', 'true');
    expect(surface).toHaveAttribute('data-admin-modal-surface', 'true');
    expect(embedded).not.toHaveAttribute('data-admin-modal-surface');
  });

  it('covers legacy full-screen modals that still have no dialog semantics', () => {
    const overlay = createViewportOverlay();
    overlay.className = 'fixed inset-0 legacy-modal';
    const surface = document.createElement('div');
    overlay.appendChild(surface);

    refreshAdminModalContract();

    expect(overlay).toHaveAttribute('data-admin-modal-overlay', 'true');
    expect(surface).toHaveAttribute('data-admin-modal-surface', 'true');
  });

  it('activates and cleans the contract with the admin layout lifecycle', () => {
    const cleanup = installAdminModalContract();

    expect(document.documentElement).toHaveAttribute('data-admin-route-active', 'true');

    cleanup();

    expect(document.documentElement).not.toHaveAttribute('data-admin-route-active');
  });
});

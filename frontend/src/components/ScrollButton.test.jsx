// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ScrollButton from './ScrollButton';

beforeEach(() => {
  document.body.innerHTML = '<section id="before"></section><section id="instagram" style="scroll-margin-top:102px"></section><section id="after"></section>';
  ['before', 'instagram', 'after'].forEach((id, i) => {
    Object.defineProperty(document.getElementById(id), 'offsetTop', { value: i * 1000 });
  });
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); document.body.innerHTML = ''; });

function mountAt(top, offsetTopPx = 0) {
  vi.spyOn(window, 'scrollY', 'get').mockReturnValue(top);
  render(<ScrollButton config={{ sectionIds: ['before', 'instagram', 'after'], offsetTopPx, behavior: 'auto' }} />);
}

it('keeps Instagram below the returning header when navigating upward', () => {
  mountAt(2000);
  fireEvent.click(screen.getByRole('button', { name: 'Sección anterior' }));
  expect(window.scrollTo).toHaveBeenCalledWith({ top: 898, behavior: 'auto' });
});

it('fills the viewport without a header gap when navigating downward', () => {
  mountAt(0);
  fireEvent.click(screen.getByRole('button', { name: 'Siguiente sección' }));
  expect(window.scrollTo).toHaveBeenCalledWith({ top: 1000, behavior: 'auto' });
});

it('preserves a larger configured header offset', () => {
  mountAt(2000, 150);
  fireEvent.click(screen.getByRole('button', { name: 'Sección anterior' }));
  expect(window.scrollTo).toHaveBeenCalledWith({ top: 850, behavior: 'auto' });
});

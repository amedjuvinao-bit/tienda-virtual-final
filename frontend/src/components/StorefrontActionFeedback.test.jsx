import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter } from 'react-router-dom';
import StorefrontActionFeedback from './StorefrontActionFeedback';
import { mountStorefrontActionFeedback } from '../lib/storefrontActionFeedback';

vi.mock('../lib/storefrontActionFeedback', () => ({ mountStorefrontActionFeedback: vi.fn() }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

it('mounts once per store route, removes stale effects on navigation and leaves admin routes alone', () => {
  const stop = vi.fn(); mountStorefrontActionFeedback.mockReturnValue(stop);
  render(<MemoryRouter><StorefrontActionFeedback/><Link to="/buscar">Buscar</Link><Link to="/admin/login">Admin</Link><Link to="/carrito">Carrito</Link></MemoryRouter>);
  expect(mountStorefrontActionFeedback).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByText('Buscar')); expect(stop).toHaveBeenCalledTimes(1); expect(mountStorefrontActionFeedback).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByText('Admin')); expect(stop).toHaveBeenCalledTimes(2); expect(mountStorefrontActionFeedback).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByText('Carrito')); expect(mountStorefrontActionFeedback).toHaveBeenCalledTimes(3);
  cleanup(); expect(stop).toHaveBeenCalledTimes(3);
});

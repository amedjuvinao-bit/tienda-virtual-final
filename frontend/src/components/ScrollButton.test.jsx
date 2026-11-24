// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import ScrollButton from './ScrollButton';
import { JOURNEY_CONTROL_NAVIGATION } from '../lib/storefrontJourneyInput';

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

it('uses the stable flow position when a section is pinned over the previous card',()=>{
  document.getElementById('instagram').dataset.storyTop='1400';
  document.getElementById('after').dataset.storyTop='2400';
  mountAt(1400);
  fireEvent.click(screen.getByRole('button',{name:'Siguiente sección'}));
  expect(window.scrollTo).toHaveBeenCalledWith({top:2400,behavior:'auto'});
});

it('announces the control choreography before keeping the original native smooth scroll',()=>{
  const story=document.createElement('div');story.className='storefront-sections';
  story.append(...document.querySelectorAll('section'));document.body.append(story);
  const navigate=vi.fn();story.addEventListener(JOURNEY_CONTROL_NAVIGATION,navigate);
  vi.spyOn(window,'scrollY','get').mockReturnValue(0);
  render(<ScrollButton config={{sectionIds:['before','instagram','after'],behavior:'smooth'}}/>);
  fireEvent.click(screen.getByRole('button',{name:'Siguiente sección'}));
  expect(navigate).toHaveBeenCalledOnce();
  expect(navigate.mock.invocationCallOrder[0]).toBeLessThan(window.scrollTo.mock.invocationCallOrder[0]);
  expect(window.scrollTo).toHaveBeenCalledExactlyOnceWith({top:1000,behavior:'smooth'});
});

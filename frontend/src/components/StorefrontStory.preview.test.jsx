import React,{useRef} from 'react';
import {act,cleanup,render} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import StorefrontStory from './StorefrontStory';
import {mountStorefrontSectionMotion} from '../lib/storefrontSectionMotion';
import {mountDecorativeJourney} from '../lib/decorativeJourney';
import {mountJourneyParallax} from '../lib/storefrontJourneyParallax';
import {SCROLL_RESTORE_START,SCROLL_RESTORED} from '../lib/storefrontScrollRestoration';
vi.mock('../lib/storefrontSectionMotion',()=>({mountStorefrontSectionMotion:vi.fn(()=>vi.fn())}));
vi.mock('../lib/decorativeJourney',()=>({mountDecorativeJourney:vi.fn(()=>vi.fn())}));
vi.mock('../lib/storefrontJourneyParallax',()=>({mountJourneyParallax:vi.fn(()=>vi.fn())}));
afterEach(()=>{cleanup();delete document.documentElement.dataset.storefrontRestoring;vi.restoreAllMocks();vi.clearAllMocks();});
function Preview(){const viewport=useRef(null);return <div ref={viewport} data-testid="viewport"><StorefrontStory viewportRef={viewport}><section id="demo">Contenido</section></StorefrontStory></div>;}
it('binds every journey engine to the parent preview viewport after its ref attaches',()=>{
 let frame;vi.spyOn(window,'requestAnimationFrame').mockImplementation(cb=>{frame=cb;return 1;});vi.spyOn(window,'cancelAnimationFrame').mockImplementation(()=>{});
 const view=render(<Preview/>);expect(mountJourneyParallax).not.toHaveBeenCalled();act(()=>frame(16));
 expect(view.container.querySelector('[data-journey-curtain]')).toBeNull();
 for(const mount of[mountStorefrontSectionMotion,mountDecorativeJourney,mountJourneyParallax])expect(mount.mock.calls[0][2].scroller).toBe(view.getByTestId('viewport'));
 view.unmount();for(const mount of[mountStorefrontSectionMotion,mountDecorativeJourney,mountJourneyParallax])expect(mount.mock.results[0].value).toHaveBeenCalledOnce();
});
it('does not mount a deferred preview after it has been removed',()=>{
 let frame;vi.spyOn(window,'requestAnimationFrame').mockImplementation(cb=>{frame=cb;return 1;});const cancel=vi.spyOn(window,'cancelAnimationFrame').mockImplementation(()=>{});
 const view=render(<Preview/>);view.unmount();act(()=>frame(16));
 expect(cancel).toHaveBeenCalledWith(1);expect(mountJourneyParallax).not.toHaveBeenCalled();expect(mountStorefrontSectionMotion).not.toHaveBeenCalled();
});
it('waits for restored scroll before mounting the scene and rebuilds it in place once',()=>{
 document.documentElement.dataset.storefrontRestoring='true';
 const view=render(<StorefrontStory><section id="categorias">Colecciones</section></StorefrontStory>);
 expect(mountJourneyParallax).not.toHaveBeenCalled();
 act(()=>document.dispatchEvent(new CustomEvent(SCROLL_RESTORED)));
 for(const mount of[mountStorefrontSectionMotion,mountDecorativeJourney,mountJourneyParallax])expect(mount.mock.calls[0][2].restored).toBe(true);
 delete document.documentElement.dataset.storefrontRestoring;
 act(()=>document.dispatchEvent(new CustomEvent(SCROLL_RESTORE_START)));
 for(const mount of[mountStorefrontSectionMotion,mountDecorativeJourney,mountJourneyParallax])expect(mount.mock.results[0].value).toHaveBeenCalledOnce();
 act(()=>document.dispatchEvent(new CustomEvent(SCROLL_RESTORED)));
 expect(mountJourneyParallax).toHaveBeenCalledTimes(2);view.unmount();
 expect(mountJourneyParallax.mock.results[1].value).toHaveBeenCalledOnce();
});

import { clampStory } from './storefrontStoryConfig';

// Transition inside the last viewport of the previous chapter. A short final
// chapter ends at the real document bottom, without extra scrolling or spacers.
export function sceneEntry(chapter,previous,y,viewport,maxScroll,pace='balanced',clearance=0) {
  if(!previous || maxScroll<=0)return {progress:1,lift:0};
  const start=Math.max(previous.top,chapter.top-viewport), end=Math.min(chapter.top-clearance,maxScroll);
  const raw=end<=start?(y>=end?1:0):clampStory((y-start)/(end-start));
  const progress=Math.pow(raw,{quick:.78,balanced:1,leisurely:1.22}[pace] || 1);
  const restTop=Math.max(0,chapter.top-end,viewport-chapter.height);
  return {progress,lift:raw>0 && raw<1?Math.max(0,chapter.top-y-restTop):0};
}

// Nine native clip windows reveal the actual section. No duplicate DOM, video,
// iframe, link or account request is created for the mosaic transition.
export function mosaicClip(progress,width,height,viewport,side=1) {
  const cellWidth=width/3, cellHeight=Math.min(viewport,height)/3;
  const paths=[];
  const rectangle=(x,y,w,h)=>`M${x.toFixed(2)} ${y.toFixed(2)}h${w.toFixed(2)}v${h.toFixed(2)}h${(-w).toFixed(2)}Z`;
  for(let row=0;row<3;row++)for(let col=0;col<3;col++) {
    const delay=(row+(side>0?col:2-col))*.13;
    const local=clampStory((progress-delay)/.48), reveal=local*local*(3-2*local);
    const w=cellWidth, h=cellHeight*reveal;
    const x=col*cellWidth+(1-local)*side*cellWidth*.08;
    const y=(row+.5)*cellHeight-h/2;
    paths.push(rectangle(x,y,w,h));
  }
  // Content below the staged viewport stays intact while long sections enter.
  if(height>cellHeight*3)paths.push(rectangle(0,cellHeight*3,width,height-cellHeight*3));
  return `path("${paths.join(' ')}")`;
}

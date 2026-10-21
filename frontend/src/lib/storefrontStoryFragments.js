// Static cards can be reconstructed from cropped copies of their own content.
// Players are always revealed in place, never copied or restarted.
export function storyFragmentImage(actor) {
  const node=actor.element, view=node.ownerDocument.defaultView;
  if(node.matches('img,video,iframe') || node.querySelector('video,iframe,audio,canvas'))return null;
  const images=node.matches('img')?[node]:[...node.querySelectorAll('img')];
  return images.filter(image=>{
    const box=image.getBoundingClientRect(), css=view.getComputedStyle(image);
    return !!image.getAttribute('src') && box.width>3 && box.height>3 && css.display!=='none' && css.visibility!=='hidden';
  }).sort((a,b)=>b.getBoundingClientRect().width*b.getBoundingClientRect().height-a.getBoundingClientRect().width*a.getBoundingClientRect().height)[0];
}

function stripePolygon(progress) {
  const points=[];
  for(let i=0;i<8;i++){
    const left=i*12.5,right=left+12.5*progress;
    points.push(`${left}% 0%`,`${right}% 0%`,`${right}% 100%`,`${left}% 100%`,`${left}% 0%`);
  }
  return `polygon(${points.join(',')})`;
}

export function storyWeaveFallback() {
  return [{opacity:1,clipPath:stripePolygon(0)},{opacity:1,clipPath:stripePolygon(1)}];
}

function staticCardCopy(node,width,height,left) {
  const copy=node.cloneNode(true);
  // Clones are visual-only: no identifiers, navigation or form submission.
  [copy,...copy.querySelectorAll('*')].forEach(element=>{
    for(const attribute of [...element.attributes])if(attribute.name==='id' || attribute.name==='name' || attribute.name==='href' || attribute.name.startsWith('data-story') || attribute.name.startsWith('on'))element.removeAttribute(attribute.name);
    if(element.matches('img')){element.loading='eager';element.alt='';}
  });
  Object.assign(copy.style,{position:'absolute',left:`${left}px`,top:'0',margin:'0',boxSizing:'border-box',pointerEvents:'none',animation:'none',transition:'none'});
  for(const [property,value] of Object.entries({width:`${width}px`,height:`${height}px`,'min-width':'0','max-width':'none',transform:'none',translate:'none',rotate:'none',scale:'none',opacity:'1'}))copy.style.setProperty(property,value,'important');
  copy.inert=true;return copy;
}

export function startStoryFragments(actor,surface,{delay,duration,compact,intensity}) {
  if(!storyFragmentImage(actor))return null;
  const node=actor.element,doc=node.ownerDocument,css=doc.defaultView.getComputedStyle(node);
  const count=compact?5:8,width=node.offsetWidth,height=node.offsetHeight;
  const overlay=doc.createElement('div');
  overlay.className='storefront-image-weave';overlay.dataset.storyFragments='true';overlay.setAttribute('aria-hidden','true');overlay.inert=true;
  // A child overlay inherits the card's exact transform and containing block.
  // It cannot change sibling selectors, flex sizing or the final mobile tile.
  Object.assign(overlay.style,{left:`${-(parseFloat(css.borderLeftWidth)||0)}px`,top:`${-(parseFloat(css.borderTopWidth)||0)}px`,width:`${width}px`,height:`${height}px`});
  const animations=[];
  for(let i=0;i<count;i++){
    const stripe=doc.createElement('span');stripe.className='storefront-image-weave__stripe';
    Object.assign(stripe.style,{left:`${i/count*100}%`,width:`${100/count+.04}%`});
    stripe.append(staticCardCopy(node,width,height,-i*width/count));overlay.append(stripe);
  }
  node.append(overlay);
  [...overlay.children].forEach((stripe,i)=>{
    const offset=i%2?1:-1,distance=Math.min(height*.3,120)*(.55+.45*intensity/100);
    const animation=stripe.animate([
      {opacity:0,translate:`0 ${offset*distance}px`,scale:'.65 1.06',filter:'blur(3px)'},
      {opacity:1,offset:.16},
      {opacity:1,translate:'0 0',scale:'1 1',filter:'blur(0px)',offset:.72},
      {opacity:1,offset:.91},
      {opacity:1,translate:'0 0',scale:'1 1',filter:'blur(0px)'},
    ],{duration:duration*(1-i*.018),delay:delay+i*duration*.018,fill:'both',easing:'cubic-bezier(.22,.8,.25,1)'});
    animation.id=`story:fragment:${actor.role}:${actor.index}:${i}`;animations.push(animation);
  });
  return ()=>{animations.forEach(animation=>animation.cancel());overlay.remove();};
}

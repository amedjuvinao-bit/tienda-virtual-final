// Layout coordinates exclude the actor's temporary presentation transforms.
export function actorGeometry(element,surface,width,viewport) {
  let x=0,y=0,node=element;
  while(node && node!==surface){x+=node.offsetLeft || 0;y+=node.offsetTop || 0;node=node.offsetParent;}
  const box=element.getBoundingClientRect();
  const w=element.offsetWidth || box.width,h=element.offsetHeight || box.height;
  if(node!==surface){const parent=surface.getBoundingClientRect();x=box.left-parent.left;y=box.top-parent.top;}
  const limit=(v,n)=>Math.max(-n,Math.min(n,v));
  return {x,y,width:w,height:h,fromX:limit(width*.5-(x+w*.5),Math.min(width*.38,340)),fromY:limit(viewport*.54-(y+Math.min(h,viewport)*.5),viewport*.23)};
}

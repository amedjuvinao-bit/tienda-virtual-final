const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const overlaps=(a,b)=>a.x<b.x+b.width && a.x+a.width>b.x && a.y<b.y+b.height && a.y+a.height>b.y;

// Find a whole, empty pocket of background. Media and glass panels count as
// occupied, even if a small part of their surface happens to contain no text.
export function fitJourneyOrnament(pose,width,size,obstacles,top,bottom){
  const gap=10,available=Math.max(0,bottom-top-gap*2);
  const wanted=Math.min(size,available,width-gap*2);
  const occupied=obstacles.filter(b=>b.width>0 && b.height>0 && b.y+b.height>top && b.y<bottom);
  for(const ratio of [1,.85,.7,.55,.4,.3,.25]){
    const extent=wanted*ratio;if(extent<28)continue;
    const half=extent/2,minX=gap+half,maxX=width-gap-half,minY=top+gap+half,maxY=bottom-gap-half;
    if(maxX<minX || maxY<minY)continue;
    const xs=new Set([clamp(pose.x,minX,maxX),minX,maxX,width/2]);
    const ys=new Set([clamp(pose.y,minY,maxY),minY,maxY]);
    for(const b of occupied){
      for(const x of [b.x-gap-half,b.x+b.width+gap+half])if(x>=minX && x<=maxX)xs.add(x);
      for(const y of [b.y-gap-half,b.y+b.height+gap+half])if(y>=minY && y<=maxY)ys.add(y);
    }
    let best=null,score=Infinity;
    for(const x of xs)for(const y of ys){
      const rect={x:x-half-gap/2,y:y-half-gap/2,width:extent+gap,height:extent+gap};
      if(occupied.some(b=>overlaps(rect,b)))continue;
      const distance=(x-pose.x)**2+(y-pose.y)**2;
      if(distance<score){score=distance;best={x,y,extent};}
    }
    if(best)return best;
  }
  // A dense gallery can temporarily cover the decoration. Never substitute a
  // foreground sticker or scatter fragments over the products to keep it seen.
  return {x:clamp(pose.x,0,width),y:clamp(pose.y,top,bottom),extent:wanted};
}

export function ornamentClearance(pose,size,angle,obstacles){
  // Hide the entire artwork during a covered passage instead of cutting holes
  // into the image. Rotation is included so no tip crosses into a photograph.
  const r=angle*Math.PI/180,half=size*(Math.abs(Math.cos(r))+Math.abs(Math.sin(r)))/2;
  let distance=Infinity;
  for(const b of obstacles){
    const dx=Math.max(b.x-pose.x,0,pose.x-b.x-b.width),dy=Math.max(b.y-pose.y,0,pose.y-b.y-b.height);
    distance=Math.min(distance,Math.max(dx,dy)-half);
  }
  return clamp(distance/8,0,1);
}

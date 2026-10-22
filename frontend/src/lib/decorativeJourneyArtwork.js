// Preserve image proportions and visual area. A tall garland becomes long and
// narrow instead of being letterboxed inside a square or stretched vertically.
export function journeyArtworkLayout(width,height){
  const ratio=Number.isFinite(width) && Number.isFinite(height) && width>0 && height>0
    ? Math.max(.2,Math.min(5,height/width)):1;
  return {ratio,width:100/Math.sqrt(ratio),height:100*Math.sqrt(ratio),axis:ratio>=1?90:0};
}

export function applyJourneyArtworkLayout(piece,layout){
  const image=piece.querySelector('image');if(!image)return;
  image.setAttribute('x',String(-layout.width/2));image.setAttribute('y',String(-layout.height/2));
  image.setAttribute('width',String(layout.width));image.setAttribute('height',String(layout.height));
  piece.dataset.journeyAspect=String(layout.ratio);piece.dataset.journeyAxis=String(layout.axis);
}

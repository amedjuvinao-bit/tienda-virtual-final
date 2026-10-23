// A curved sweep inspired by the Theodore reference selected by the user.
// The silhouette clips a real store background; it never moves the content.
const clamp=n=>Math.max(0,Math.min(1,n));
const smooth=n=>{const t=clamp(n);return t*t*t*(t*(t*6-15)+10);};
export function journeyCurtainFrame(progress,width,height,{direction='down',intensity=65,compact=false}={}){
  const p=clamp(progress),cover=p<=.5,t=cover?p/.5:(p-.5)/.5;
  const margin=height*.1,edge=height+margin-(height+2*margin)*smooth(t);
  const bend=Math.sin(Math.PI*t)*height*(.26+.16*clamp(intensity/100))*(compact?.85:1);
  const y=n=>(direction==='up'?height-n:n).toFixed(2),x=n=>n.toFixed(2);
  const boundary=cover
    ?`M 0 ${y(edge)} C ${x(width*.25)} ${y(edge-bend)} ${x(width*.75)} ${y(edge-bend)} ${x(width)} ${y(edge)} L ${x(width)} ${y(height)} L 0 ${y(height)} Z`
    :`M 0 ${y(0)} L ${x(width)} ${y(0)} L ${x(width)} ${y(edge)} C ${x(width*.75)} ${y(edge-bend)} ${x(width*.25)} ${y(edge-bend)} 0 ${y(edge)} Z`;
  return {path:boundary,phase:cover?'cover':'reveal'};
}

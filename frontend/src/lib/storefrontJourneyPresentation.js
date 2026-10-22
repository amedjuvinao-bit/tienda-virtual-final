// The journey has its own handover: the real content opens in depth over the
// shared background. No covers, image copies, blur or business-specific assets.
const easing='cubic-bezier(.18,.72,.2,1)';
export function journeyChapterPresentation(intensity=65,compact=false){
  const strength=(.6+.4*intensity/100)*(compact?.65:1);
  return {duration:1250,easing,frames:[
    {transform:`perspective(1800px) translate3d(0,${32*strength}px,${-210*strength}px)`,transformOrigin:'50% 160px',perspective:'1400px'},
    {transform:'perspective(1800px) translate3d(0,0,0)',transformOrigin:'50% 160px',perspective:'1400px'},
  ]};
}

export function journeyActorPresentation(actor,intensity=65,compact=false){
  const {role,index}=actor,strength=(.6+.4*intensity/100)*(compact?.65:1),stagger=Math.min(index,7);
  const delays={eyebrow:0,title:70,copy:190,hero:180,product:260,detail:400,action:610,signature:520};
  const delay=(delays[role]??260)+stagger*95;
  if(['eyebrow','title','copy'].includes(role))return {mechanism:'journey-type',delay,duration:850,easing,frames:[
    {clipPath:'inset(0 0 100% 0)',translate:`0 ${18*strength}px`,opacity:1},
    {clipPath:'inset(0 0 0% 0)',translate:'0 0',opacity:1},
  ]};
  const side=index%2===0?1:-1,action=role==='action';
  return {mechanism:'journey-depth',delay,duration:action?950:1350,easing,frames:[
    {translate:`0 ${36*strength}px ${-180*strength}px`,rotate:action?`1 0 0 ${-38*strength}deg`:`0 1 0 ${side*30*strength}deg`,scale:String(1-.08*strength),transformOrigin:action?'50% 100%':side===1?'0% 50%':'100% 50%',opacity:1},
    {translate:'0 0 0',rotate:action?'1 0 0 0deg':'0 1 0 0deg',scale:'1',transformOrigin:action?'50% 100%':side===1?'0% 50%':'100% 50%',opacity:1},
  ]};
}

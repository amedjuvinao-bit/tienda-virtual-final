import React, { useContext, useEffect, useRef, useState } from 'react';
import { Play, ArrowUpRight, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import selection from '@shared/tiktok-selection';
import { normalizeTiktokSection } from '../../admin/appearance/sections/tiktok/tiktokSectionHelpers';
import { normalizeStage, stagePosts, stageIdentity, stagePlan, safeStageAsset, rgba } from '../../admin/appearance/sections/tiktok/tiktokStageHelpers';
import { categoriasBackdrop } from '../../admin/appearance/sections/categorias/categoriasFanHelpers';
import TiktokBrand from './TiktokBrand';
import TiktokPlayer from './TiktokPlayer';
import useTiktokFeed from './useTiktokFeed';
import { TiktokEditorFeed } from './TiktokEditorFeed';
import './tiktokStage.css';

export default function TiktokStage({theme, posts:fallback=[]}) {
  const raw = theme?.sections?.find(s=>s?.id==='tiktok'||s?.type==='tiktok');
  const section=normalizeTiktokSection(raw), c=section.config, s=normalizeStage(c);
  const editor=useContext(TiktokEditorFeed), connected=s.stageSource==='connected';
  const publicFeed=useTiktokFeed(section.enabled && connected && !editor), feed=editor || publicFeed;
  const account=connected && feed.connected ? feed.account : null, identity=stageIdentity(c,account);
  const overrides=String(c.stageOverrides?.accountId)===String(account?.id) ? c.stageOverrides?.byId || {} : {};
  const posts=connected ? stagePosts(selection.visiblePosts(feed.posts,c,account?.id).map(p=>({...p,...(typeof overrides[p.id]?.title==='string'?{title:overrides[p.id].title}:{})}))) : stagePosts(raw?.config?.posts || fallback);
  const plan=stagePlan(c,account?.id,posts);
  const [chosen,setChosen]=useState(null), [page,setPage]=useState(0), root=useRef(null), main=useRef(null), checked=useRef(new Set());
  const choice=chosen?.preferred===plan.preferred && chosen?.account===(account?.id||'') ? chosen : null;
  const current=posts.find(p=>p.id===(choice?.id || plan.preferred)) || posts[0];
  const missingPrincipal=connected && feed.connected && plan.preferred && !posts.some(p=>p.id===plan.preferred) && (feed.nextCursor || feed.loading) && !feed.error && !choice;
  useEffect(()=>{checked.current.clear();},[account?.id]);
  useEffect(()=>{
    if(!connected || !feed.connected || feed.loading || feed.error || !feed.nextCursor || !plan.missing.length || checked.current.has(feed.nextCursor))return;
    checked.current.add(feed.nextCursor);feed.loadMore();
  },[connected,feed,plan.missing.join('|')]);
  useEffect(()=>{
    if(!s.stageResetOnEnter || typeof IntersectionObserver!=='function')return;
    let left=false;
    const observer=new IntersectionObserver(entries=>{if(!entries[0]?.isIntersecting)left=true;else if(left){setChosen(null);setPage(0);left=false;}},{threshold:.12});
    if(root.current)observer.observe(root.current);return()=>observer.disconnect();
  },[s.stageResetOnEnter]);
  useEffect(()=>{
    if(!s.stageMotionEnabled || s.stageMotion==='none' || !main.current?.animate || window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches)return;
    const from={fade:{opacity:.2},glide:{opacity:.2,transform:'translateY(16px)'},focus:{opacity:.2,filter:'blur(6px)'},zoom:{opacity:.3,transform:'scale(.97)'}}[s.stageMotion];
    const a=main.current.animate([from,{opacity:1,transform:'none',filter:'blur(0)'}],{duration:s.stageMotionDuration,easing:'cubic-bezier(.2,.7,.2,1)'});return()=>a.cancel();
  },[current?.id,s.stageMotion,s.stageMotionEnabled,s.stageMotionDuration]);
  if(!section.enabled)return null;
  let background={color:s.stageBackgroundColor,image:''};
  if(s.stageBackgroundMode==='included')background.image='/instagram/journal-satin.webp';
  if(s.stageBackgroundMode==='custom')background.image=safeStageAsset(s.stageBackgroundImage);
  if(['continuity','global'].includes(s.stageBackgroundMode))background=categoriasBackdrop(theme,{}, {fanBackgroundMode:s.stageBackgroundMode});
  const vars={
    '--tk-ink':s.stageInk,'--tk-accent':s.stageAccent,'--tk-glass':rgba(s.stageGlassColor,s.stageGlassOpacity/100),
    '--tk-blur':`${s.stageBlur}px`,'--tk-depth':`${s.stageDepth}px`,'--tk-shadow':s.stageShadow/100,
    '--tk-reflection':s.stageReflection/100,'--tk-texture':s.stageTexture/100,'--tk-radius':`${s.stageRadius}px`,
    '--tk-font':s.stageFont,'--tk-title':`${s.stageTitleSize}px`,'--tk-text':`${s.stageTextSize}px`,
    '--tk-button':s.stageButtonColor,'--tk-button-text':s.stageButtonText,'--tk-max':`${s.stageMaxWidth}px`,
    '--tk-pad-x':`${s.stagePaddingX}px`,'--tk-pad-y':`${s.stagePaddingY}px`,'--tk-gap':`${s.stageGap}px`,
    '--tk-video-height':`${s.stageVideoHeight}px`,'--tk-left':`${s.stageLeftWidth}fr`,'--tk-right':`${s.stageRightWidth}fr`,
    '--tk-middle':`${100-s.stageLeftWidth-s.stageRightWidth}fr`,'--tk-mobile-title':`${s.stageMobileTitleSize}px`,
    '--tk-mobile-pad':`${s.stageMobilePadding}px`,'--tk-mobile-height':`${s.stageMobileVideoHeight}px`,
    '--tk-wash':rgba(s.stageBackgroundColor,s.stageBackgroundWash/100),
    backgroundColor:background.color, ...(background.image?{backgroundImage:`url("${background.image.replace(/["\\\n\r]/g,'')}")`}:{}),
  };
  const maxPage=Math.max(0,Math.ceil(posts.length/s.stageListSize)-1), activePage=Math.min(page,maxPage), shown=posts.slice(activePage*s.stageListSize,(activePage+1)*s.stageListSize);
  const choose=id=>{setChosen({id,preferred:plan.preferred,account:account?.id||'',play:true});main.current?.focus({preventScroll:true});};
  const state=feed.loading || connected && !feed.loaded || missingPrincipal ? 'Cargando videos…' : feed.error || 'Pronto compartiremos nuevos videos.';
  const light=e=>{if(!s.stageMotionEnabled || s.stageHover==='none' || e.pointerType==='touch')return;const r=e.currentTarget.getBoundingClientRect();e.currentTarget.style.setProperty('--tk-light-x',`${(e.clientX-r.left)/r.width*100}%`);e.currentTarget.style.setProperty('--tk-light-y',`${(e.clientY-r.top)/r.height*100}%`);};
  return <section className="tk-stage" ref={root} style={vars} data-motion={s.stageMotionEnabled} data-hover={s.stageHover} aria-label="Videos de TikTok">
    <div className="tk-stage__inner">
      {s.stageEyebrow && <div className="tk-stage__eyebrow"><i/>{s.stageEyebrow}<i/></div>}
      <div className="tk-stage__grid" data-list={s.stageShowList}>
        <header className="tk-stage__intro">
          {s.stageShowBrand && <TiktokBrand/>}
          {s.stageShowProfile && <div className="tk-stage__identity">{s.stageShowAvatar && identity.avatar && <img src={identity.avatar} alt={identity.name || 'Perfil de TikTok'}/>}<div>{identity.user && (identity.url?<a href={identity.url} target="_blank" rel="noopener noreferrer">{identity.user}</a>:<span>{identity.user}</span>)}{identity.name && <span className="tk-stage__name">{identity.name}</span>}</div></div>}
          <div className="tk-stage__ornament" aria-hidden="true"><i/>✧<i/></div>
          {s.stageShowTitle && s.stageTitle && <h2>{s.stageTitle}</h2>}
          {s.stageShowSubtitle && s.stageSubtitle && <p className="tk-stage__subtitle">{s.stageSubtitle}</p>}
          {s.stageShowFollow && identity.url && <a className="tk-stage__follow" href={identity.url} target="_blank" rel="noopener noreferrer">{s.stageFollowText}<ArrowUpRight size={20}/></a>}
        </header>
        <div className="tk-stage__hero tk-glass" onPointerMove={light}>
          <div ref={main} className="tk-stage__media" tabIndex={-1}>
            {current && !missingPrincipal ? <TiktokPlayer key={`${current.id}:${choice?.play?'play':'still'}`} post={current} settings={s} requestPlay={Boolean(choice?.play)}/> : <div className="tk-stage__empty"><TiktokBrand wordmark={false}/><p role="status">{state}</p>{feed.error && <button onClick={feed.retry}>Volver a intentar</button>}{feed.nextCursor && <button disabled={feed.loading} onClick={feed.loadMore}>Cargar videos</button>}</div>}
          </div>
        </div>
        {s.stageShowList && <aside className="tk-stage__playlist tk-glass" onPointerMove={light} aria-label={s.stageListTitle || 'Lista de videos'}>
          {s.stageListTitle && <h3>{s.stageListTitle}<i/><span aria-hidden="true">✦</span></h3>}
          <div className="tk-stage__items">{shown.map(post=><article className="tk-stage__item tk-glass" key={post.id} data-active={post.id===current?.id}>
            <button type="button" className="tk-stage__select" aria-label={`Seleccionar video: ${post.title}`} aria-pressed={post.id===current?.id} onClick={()=>choose(post.id)}>
              <span className="tk-stage__thumb">{post.image?<img src={post.image} alt="" loading="lazy" style={{objectPosition:`${post.positionX}% ${post.positionY}%`}}/>:<span className="tk-stage__no-cover">♪</span>}<span className="tk-stage__mini-play"><Play size={20} fill="currentColor"/></span></span>
              <span className="tk-stage__summary"><span className="tk-stage__item-title">{post.title}</span><span className="tk-stage__wave" aria-hidden="true">{Array.from({length:27},(_,i)=><i key={i} style={{height:`${6+(i*7%21)}px`,animationDelay:`${i*-35}ms`}}/>)}</span></span>
            </button>
            {post.link && <a className="tk-stage__item-link" href={post.link} target="_blank" rel="noopener noreferrer" aria-label={`${s.stageVideoText}: ${post.title}`}><ArrowUpRight size={25}/></a>}
          </article>)}</div>
          {!shown.length && <p className="tk-stage__list-empty" role="status">{state}</p>}
          {(maxPage>0 || connected && (feed.nextCursor || feed.error)) && <nav className="tk-stage__pages" aria-label="Páginas de videos"><button aria-label="Videos anteriores" disabled={activePage===0} onClick={()=>setPage(activePage-1)}><ChevronLeft size={18}/></button><span>{activePage+1} / {maxPage+1}</span><button aria-label="Videos siguientes" disabled={activePage===maxPage} onClick={()=>setPage(activePage+1)}><ChevronRight size={18}/></button>{connected && feed.nextCursor && <button disabled={feed.loading} onClick={feed.loadMore}>{feed.loading?'Cargando…':'Cargar más'}</button>}{feed.error && <button onClick={feed.retry} aria-label="Volver a cargar TikTok"><RefreshCw size={16}/></button>}</nav>}
        </aside>}
      </div>
    </div>
  </section>;
}

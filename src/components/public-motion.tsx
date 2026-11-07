'use client';
import type {PublicLocale} from '@/lib/public-locale';
import {useEffect,useRef,type ReactNode} from 'react';
export default function PublicMotion({children,locale='tr'}:{children:ReactNode;locale?:PublicLocale}){
 const root=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!root.current||!('IntersectionObserver' in window)||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const nodes=[...root.current.querySelectorAll<HTMLElement>('[data-reveal]')];
  const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.remove('reveal-pending');observer.unobserve(e.target);}}),{threshold:0,rootMargin:'0px 0px -35px 0px'});
  for(const node of nodes){if(node.getBoundingClientRect().top>=window.innerHeight){node.classList.add('reveal-pending');observer.observe(node);}}
  return()=>{observer.disconnect();nodes.forEach(n=>n.classList.remove('reveal-pending'));};
 },[]);
 return <div ref={root} lang={locale} className="public-site public-multipage">{children}</div>;
}

import type {SiteContent} from './site-content';
export type NavContent=Pick<SiteContent,'brand'|'brandSubtitle'|'navAbout'|'navPrograms'|'navCoaches'|'navContact'|'navLogin'>;
export function navContent(c:SiteContent):NavContent{return {brand:c.brand,brandSubtitle:c.brandSubtitle,navAbout:c.navAbout,navPrograms:c.navPrograms,navCoaches:c.navCoaches,navContact:c.navContact,navLogin:c.navLogin};}

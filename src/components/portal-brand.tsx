export default function PortalBrand({href,subtitle}:{href:string;subtitle:string}){
 return <a href={href} className="brand portal-brand"><span className="portal-brand-mark"><img src="/legacy/images/marka/favicon-512.png" alt="Alanya Deniz Aslanları kulüp logosu" width={52} height={52}/><b>DAS<span aria-hidden="true">/</span></b></span><span className="portal-brand-name">DENİZ ASLANLARI<small>{subtitle}</small></span></a>;
}

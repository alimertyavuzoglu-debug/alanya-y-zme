import PublicSite from '@/components/public-site';
import {publicContent} from '@/lib/public-content';
export const dynamic='force-dynamic';
export default async function Page(){return <PublicSite content={await publicContent()}/>;}

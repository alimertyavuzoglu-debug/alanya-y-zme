import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import AcceptInvitation from '@/components/accept-invitation';
import { inviteTokenSchema } from '@/lib/invitations';
export const dynamic='force-dynamic';
export const metadata: Metadata={title:'Antrenör daveti | Deniz Aslanları',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function InvitePage({params}:{params:Promise<{token:string}>}) {
 const {token}=await params;if(!inviteTokenSchema.safeParse(token).success)notFound();
 return <AcceptInvitation token={token}/>;
}

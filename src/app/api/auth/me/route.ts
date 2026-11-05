import { NextResponse } from 'next/server';
import { authenticated, databaseFailure } from '@/lib/http';
export const dynamic = 'force-dynamic';
export async function GET() {
 const auth = await authenticated(); if (auth.response) return auth.response;
 const { data, error } = await auth.client.from('user_roles').select('role').eq('user_id',auth.user.id);
 if(error) return databaseFailure(error);
 const { data: profile, error: profileError } = await auth.client.from('profiles').select('display_name').eq('id',auth.user.id).single();
 if(profileError) return databaseFailure(profileError);
 return NextResponse.json({ user: { id: auth.user.id, display_name: profile.display_name }, roles: data.map(row => row.role) }, { headers:{'Cache-Control':'no-store'} });
}

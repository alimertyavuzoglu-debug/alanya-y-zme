import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticated, databaseFailure, failure } from '@/lib/http';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
 const auth = await authenticated(); if (auth.response) return auth.response;
 const url = new URL(request.url);
 const interval = z.object({ from: z.string().datetime({offset:true}), until: z.string().datetime({offset:true}) })
 .refine(v => Date.parse(v.until)>Date.parse(v.from) && Date.parse(v.until)-Date.parse(v.from)<=93*86400000)
 .safeParse({from:url.searchParams.get('from'),until:url.searchParams.get('until')});
 if(!interval.success) return failure('En fazla 93 günlük geçerli tarih aralığı gerekli.',422);
 // Complete club-wide reporting is admin-only; coach attendance reads remain
 // restricted to the records that coach entered.
 const {data: roles,error: roleError}=await auth.client.from('user_roles').select('role').eq('user_id',auth.user.id);
 if(roleError) return databaseFailure(roleError);
 if(!roles.some(r=>r.role==='ADMIN')) return failure('Yönetici yetkisi gerekli.',403);
 const {data,error}=await auth.client.rpc('lesson_report',{from_time:interval.data.from,until_time:interval.data.until});
 if(error) return databaseFailure(error);
 return NextResponse.json({data},{headers:{'Cache-Control':'no-store'}});
}

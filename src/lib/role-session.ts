import {authenticated,databaseFailure,failure} from './http';
export async function roleSession(role:'ADMIN'|'COACH'){
 const auth=await authenticated();if(auth.response)return auth;
 const {data,error}=await auth.client.from('user_roles').select('role').eq('user_id',auth.user.id);
 if(error)return {response:databaseFailure(error)};
 if(!data.some(r=>r.role===role))return {response:failure(role==='ADMIN'?'Yönetici yetkisi gerekli.':'Antrenör yetkisi gerekli.',403)};
 return auth;
}
export function setupFailure(){return failure('Bu özellik için 005 ek kurulumu Supabase’de çalıştırılmalı.',503);}

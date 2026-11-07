import {z} from 'zod';
export const loginSchema=z.object({email:z.string().trim().toLowerCase().email().max(254),password:z.string().min(1).max(256)}).strict();
/** Only controlled messages leave the server; never expose Auth response bodies or credentials. */
export function loginFailure(error:{code?:string;status?:number;name?:string}){
 if(error.code==='email_not_confirmed')return {status:403,message:'Bu hesabın e-posta adresi henüz doğrulanmamış. Önce e-posta doğrulamasını tamamlayın.'};
 if(error.code==='user_banned')return {status:403,message:'Bu hesabın girişi kısıtlanmış. Kulüp yöneticisiyle görüşün.'};
 if(error.status===429||error.code==='over_request_rate_limit'||error.code==='over_email_send_rate_limit')return {status:429,message:'Çok fazla giriş denemesi yapıldı. Biraz bekleyip tekrar deneyin.'};
 if(error.code==='invalid_credentials'||error.code==='invalid_grant')return {status:401,message:'E-posta veya parola hatalı. Kulüp hesabınız için belirlediğiniz parolayı kullanın.'};
 return {status:503,message:'Giriş hizmetine şu anda ulaşılamıyor. Biraz sonra tekrar deneyin.'};
}

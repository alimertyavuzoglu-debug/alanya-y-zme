/** Limited text formatting. Raw HTML is always rendered as text, never executed. */
export function publicHref(value:string):string|null{
 if(value.startsWith('/')&&!value.startsWith('//')&&!value.includes('\\')&&!/[\u0000-\u001f]/.test(value))return value;
 try{const u=new URL(value);if(['https:','tel:','mailto:'].includes(u.protocol)&&!u.username&&!u.password)return value;}catch{}
 return null;
}
export function publicImage(value:string){
 if(/^\/(?:images|legacy\/images|legacy\/video)\/[a-zA-Z0-9/_\-.]+$/.test(value))return value;
 try{const u=new URL(value);if(u.protocol==='https:'&&!u.username&&!u.password)return value;}catch{}
 return null;
}

import {z} from 'zod';
export const lessonLabels={SWIMMING:'Yüzme',TRIATHLON:'Triatlon',PRIVATE:'Birebir ders'} as const;
export const trialApplicationSchema=z.object({
 name:z.string().trim().min(2).max(150),
 phone:z.string().trim().max(30).refine(v=>/^[+0-9 ()-]+$/.test(v)&&v.replace(/\D/g,'').length>=10&&v.replace(/\D/g,'').length<=15,'Geçerli bir telefon numarası girin.'),
 register_for:z.enum(['SELF','CHILD']),
 child_age:z.number().int().min(1).max(25).nullable(),
 lesson_type:z.enum(['SWIMMING','TRIATHLON','PRIVATE']),
 message:z.string().trim().max(1000),
 consent:z.literal(true),
}).strict().refine(v=>v.register_for!=='CHILD'||v.child_age!==null,'Çocuğun yaşını girin.');
export type TrialApplication=z.infer<typeof trialApplicationSchema>;
export function trialEmailFields(value:TrialApplication){
 return {name:value.name,phone:value.phone,register_for:value.register_for==='CHILD'?'Çocuğum için':'Kendim için',
  ...(value.register_for==='CHILD'?{child_age:String(value.child_age)}:{}),
  lesson_type:lessonLabels[value.lesson_type],message:value.message,kvkk_consent:'Başvuru amacıyla iletişim bilgisi paylaşımı kabul edildi.'};
}

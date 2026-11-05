'use client';
import { useEffect, useRef, useState } from 'react';
import { toInstant, toLocalInput } from '@/lib/club-client';
export type Option = { value: string; label: string };
export type Field = { key: string; label: string; type?: 'text'|'email'|'date'|'datetime-local'|'time'|'number'|'textarea'|'select'|'checkbox'; options?: Option[]; optional?: boolean; nullable?: boolean; min?: number; max?: number; immutable?: boolean };
export type FormDefinition = { title: string; resource: string; fields: Field[]; initial?: Record<string,unknown>; keys?: string[]; hint?: string; submitLabel?: string };
export function formPayload(fields: Field[], form: FormData) {
  const body: Record<string, unknown> = {};
  for (const f of fields) {
    if (f.type === 'checkbox') { body[f.key] = form.get(f.key) === 'on'; continue; }
    const value = String(form.get(f.key) ?? '').trim();
    if (!value && f.optional) { if (f.nullable) body[f.key]=null; continue; }
    body[f.key] = f.type==='number' ? Number(value) : f.type==='datetime-local' ? toInstant(value) : value;
  }
  return body;
}
export function RecordForm({ definition, onClose, onSave }: { definition: FormDefinition; onClose:()=>void; onSave:(payload:Record<string,unknown>)=>Promise<void> }) {
 const dialog=useRef<HTMLDialogElement>(null);
 const [busy,setBusy]=useState(false); const [error,setError]=useState('');
 useEffect(()=>{ const node=dialog.current; node?.showModal(); return ()=>node?.close(); },[]);
 async function submit(event:React.FormEvent<HTMLFormElement>) {
  event.preventDefault(); setError(''); setBusy(true);
  try { await onSave(formPayload(definition.fields,new FormData(event.currentTarget))); onClose(); }
  catch(e) { setError(e instanceof Error ? e.message : 'Kayıt tamamlanamadı.'); }
  finally {setBusy(false);}
 }
 return <dialog ref={dialog} className="form-dialog" aria-labelledby="form-title" onCancel={e=>{if(busy)e.preventDefault();else onClose();}}>
  <div className="dialog-heading"><div><span className="eyebrow">KULÜP YÖNETİMİ</span><h2 id="form-title">{definition.title}</h2></div><button type="button" className="icon-button" aria-label="Pencereyi kapat" disabled={busy} onClick={onClose}>×</button></div>
  {definition.hint && <p className="muted">{definition.hint}</p>}
  <form onSubmit={submit}>
   <fieldset disabled={busy} className="form-grid">
    {definition.fields.map((f,i)=>{
     const initial=definition.initial?.[f.key];
     const value=initial==null?'': f.type==='datetime-local'?toLocalInput(String(initial)):String(initial);
     const frozen=Boolean(definition.initial && f.immutable);
     return <label key={f.key} className={f.type==='textarea'?'field full':'field'}><span>{f.label}{!f.optional && f.type!=='checkbox' && <span aria-hidden="true"> *</span>}</span>
      {f.type==='select' ? <><select name={frozen?undefined:f.key} defaultValue={value} required={!f.optional} disabled={frozen} autoFocus={i===0}><option value="">{f.optional?'Seçim yok':'Seçiniz'}</option>{f.options?.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>{frozen&&<input type="hidden" name={f.key} value={value}/>}</>
      :f.type==='textarea'?<textarea name={f.key} defaultValue={value} required={!f.optional} maxLength={f.max??20000} rows={5}/>
      :f.type==='checkbox'?<input type="checkbox" name={f.key} defaultChecked={initial===undefined?true:Boolean(initial)}/>
      :<input name={f.key} type={f.type??'text'} defaultValue={value} required={!f.optional} readOnly={frozen} min={f.type==='number'?f.min:undefined} max={f.type==='number'?f.max:undefined} maxLength={f.type==='text'||f.type==='email'||!f.type?f.max??150:undefined} autoFocus={i===0}/>}
     </label>;
    })}
   </fieldset>
   {error&&<p className="notice error" role="alert">{error}</p>}
   <div className="dialog-actions"><button type="button" className="button secondary" onClick={onClose} disabled={busy}>Vazgeç</button><button className="button" disabled={busy}>{busy?'Kaydediliyor…':definition.submitLabel??'Kaydet'}</button></div>
  </form>
 </dialog>;
}

import type { ReactNode } from 'react';
import type { RecordRow } from '@/lib/club-client';
export type Column = { heading: string; render:(row:RecordRow)=>ReactNode };
export function DataTable({ rows, columns, empty='Henüz kayıt yok.', actions }: {rows:RecordRow[];columns:Column[];empty?:string;actions?:(row:RecordRow)=>ReactNode}) {
 return rows.length ? <div className="table-scroll" tabIndex={0} aria-label="Kayıt tablosu"><table><thead><tr>{columns.map(c=><th key={c.heading} scope="col">{c.heading}</th>)}{actions&&<th scope="col">İşlemler</th>}</tr></thead><tbody>{rows.map((r,i)=><tr key={String(r.id??`${r.session_id}-${r.athlete_id??r.coach_id??i}`)}>{columns.map(c=><td key={c.heading}>{c.render(r)}</td>)}{actions&&<td><div className="row-actions">{actions(r)}</div></td>}</tr>)}</tbody></table></div>:<div className="empty"><span className="empty-mark" aria-hidden="true">—</span><p>{empty}</p><small>Yeni kayıt eklediğinizde burada görünecek.</small></div>;
}
export function Badge({value,text}:{value:unknown;text?:string}) {
 return <span className={`badge ${String(value).toLowerCase()}`}>{text??String(value)}</span>;
}

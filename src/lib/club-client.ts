export type RecordRow = Record<string, string | number | boolean | null>;
export type Coach = { id: string; display_name: string; is_active: boolean };
export type ClubData = Record<string, RecordRow[]>;
export const tables = ['groups','group_terms','athletes','enrollments','coach_assignments','training_plans','schedule_rules','sessions','session_coaches','session_athletes','athlete_attendance'] as const;

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(path, { ...options, cache: 'no-store', headers: { 'Content-Type': 'application/json', ...options?.headers } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(body?.error ?? 'İşlem tamamlanamadı. Lütfen yeniden deneyin.', response.status);
  return body as T;
}
export async function loadTable(table: string): Promise<RecordRow[]> {
  const rows: RecordRow[] = [];
  for (let page = 0; page <= 10000; page++) {
    const result = await api<{ data: RecordRow[] }>(`/api/club/${table}?page=${page}`);
    rows.push(...result.data);
    if (result.data.length < 50) return rows;
  }
  throw new Error('Kayıt sayısı yükleme sınırını aştı. Filtreli API kullanılması gerekiyor.');
}
export const labels: Record<string, string> = {
  DRAFT:'Taslak', ACTIVE:'Aktif', CLOSED:'Kapalı', SCHEDULED:'Planlandı', COMPLETED:'Tamamlandı', CANCELLED:'İptal',
  PRESENT:'Var', ABSENT:'Yok', EXCUSED:'Mazeretli', UNCONFIRMED:'Doğrulanmadı', ATTENDED:'Katıldı',
  SWIMMING:'Yüzme', TRIATHLON:'Triatlon',
};
export function label(value: unknown) { return labels[String(value)] ?? String(value ?? '—'); }
export function dateLabel(value: unknown, time = false) {
  if (!value) return '—';
  const date = new Date(String(value).length === 10 ? `${value}T12:00:00+03:00` : String(value));
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('tr-TR',{ timeZone:'Europe/Istanbul', day:'2-digit', month:'short', year:'numeric', ...(time ? {hour:'2-digit',minute:'2-digit'} : {}) }).format(date);
}
export function istanbulDate(value: Date | string = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Istanbul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(value));
  const get = (type: string) => parts.find(p=>p.type===type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function toInstant(local: string) { return new Date(`${local}:00+03:00`).toISOString(); }
export function toLocalInput(instant: string) {
  const d = new Date(new Date(instant).getTime()+3*3600000);
  return d.toISOString().slice(0,16);
}
export const rowName = (row?: RecordRow) => row ? [row.first_name,row.last_name].filter(Boolean).join(' ') || String(row.name ?? row.title ?? row.id) : '—';
export function csvCell(value: unknown) {
  const text = String(value ?? '');
  // CSV exports may be opened in spreadsheets. Escape formula prefixes too.
  return '"'+(/^[\s]*[=+\-@\t\r]/.test(text) ? "'"+text : text).replaceAll('"','""')+'"';
}

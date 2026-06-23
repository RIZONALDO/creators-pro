const WD_LABELS = ['SEG', 'TER', 'QUA', 'QUI', 'SEX'];

/** YYYY-MM-DD a partir dos componentes LOCAIS da data. `toISOString()` converte pra UTC — em fuso
 * negativo (ex.: Brasil, UTC-3) isso "vira o dia" sozinho à noite (qualquer hora local depois de
 * ~21h já cai no dia seguinte em UTC), descasando o rótulo do dia exibido da data de fato buscada. */
export function toLocalIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayIso(): string {
  return toLocalIso(new Date());
}

/** Segunda a sexta da semana atual (data real do navegador). */
export function currentWeekWeekdays(): { iso: string; label: string; dayNum: number }[] {
  const today = new Date();
  const mondayOffset = today.getDay() === 0 ? -6 : 1 - today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() + mondayOffset);
  return WD_LABELS.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { iso: toLocalIso(d), label, dayNum: d.getDate() };
  });
}

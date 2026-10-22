// =============================================================================
//  ВИДЫ ПОДВИЖНОЙ МЕХАНИКИ — общий словарь театра: буква, название, цвет в «чертеже».
//  Используется движком (карточка, экспликация, окраска в режиме «чертёж») и панелями.
// =============================================================================

export const RIG_KINDS = {
  batten: { letter: 'Ш', name: 'Штанкет', short: 'Ш — штанкет', legend: 'Ш — штанкет', color: 0x2f6fde },
  light: { letter: 'С', name: 'Софит', short: 'С — софит', legend: 'С — софит', color: 0xe8590c },
  track: { letter: 'З', name: 'Дорога занавеса', short: 'З — дорога занавеса', legend: 'З — дорога занавеса', color: 0x8b3fd6 },
  side: { letter: 'Б', name: 'Боковой штанкет', short: 'Б — боковой', legend: 'Б — боковой штанкет', color: 0x1a9e6a },
};

export const cssColor = (c) => `#${c.toString(16).padStart(6, '0')}`;

/** Виды механики, которые реально есть в списке (в порядке словаря). */
export function kindsPresent(list = []) {
  const have = new Set(list.map((r) => r.kind));
  return Object.keys(RIG_KINDS).filter((k) => have.has(k));
}

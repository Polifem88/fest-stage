// =============================================================================
//  СПРАВОЧНИК ТИПОВ ПРИБОРОВ ТЕАТРА — общий для всех площадок.
//  Один тип описан один раз; площадки ссылаются на него по ключу (f.type).
//  Порядок ключей важен: по нему назначаются цвета корпусов в режиме «чертёж»
//  (systems/fixtures.js → typeColors). Новые типы добавлять В КОНЕЦ.
//  Паспорта производителей — library/specs.js.
// =============================================================================

/**
 * shape: внешний вид упрощённой модели
 *   spot  — голова с подвесом-вилкой, длинный корпус (Spot)
 *   wash  — голова с вилкой, короткий корпус, большая линза (Wash)
 *   beam  — голова с вилкой, компактная (B-Eye)
 *   ledpar— большой круглый LED-прожектор на лире
 *   profile — профильный (эллипсоидный) прожектор
 *   fresnel — линзовый прожектор Френеля с шторками
 *   par   — PAR-64 (банка)
 *   follow— пушка (следящий прожектор) на штативе
 */
// Типы и названия — по перечню светового цеха (20.10.2026) и ответам завцехом.
// lamp: true — ламповый прибор на диммерной линии (на схеме его номер = номер линии D).
// Остальные (головы, LED) — с цифровым управлением, питание от свитчерных линий S.
export const TYPES = {
  SPOT585: { name: 'Anzhee Pro Phoenix Spot 585 FC', shape: 'spot', beam: 16 },
  BSW350: { name: 'Anzhee Pro Phoenix BSW 350 CMY', shape: 'spot', beam: 18, scale: 0.85 },
  PLUTO: { name: 'Silver Star PLUTO 8000 WBX', shape: 'ledpar', beam: 40 },
  WASHZOOM: { name: 'DiaLighting WashZoom 37-15 V2', shape: 'wash', beam: 34, scale: 1.1 },
  WASH760: { name: 'Anzhee Pro Phoenix Wash 760z', shape: 'wash', beam: 30 },
  BEYE: { name: 'Anzhee H7x60 WP B-Eye', shape: 'beam', beam: 20 },
  PROF_CW: { name: 'Anzhee Profile Q400 (WW+CW)', shape: 'profile', beam: 26 },
  PROF_RGB: { name: 'Anzhee Profile Q400 (RGBALC)', shape: 'profile', beam: 26 },
  BROPAR: { name: 'UF Stage 4 BroPar', shape: 'ledpar', beam: 25, scale: 0.75 },
  FRESNEL: { name: 'ProСвет Fresnel 300 (WW+CW)', shape: 'fresnel', beam: 36 },
  PAR64: { name: 'PAR-64', shape: 'par', beam: 24, lamp: true },
  COMPC: { name: 'SpotLight ComPC 1000 Вт', shape: 'fresnel', beam: 30, lamp: true, scale: 0.95 },
  ETC26: { name: 'ETC Source Four 26°', shape: 'profile', beam: 26, lamp: true, scale: 0.85 },
  ETC19: { name: 'ETC Source Four 19° (линза сменная: 14° / 26°)', shape: 'profile', beam: 19, lamp: true, scale: 0.85 },
  ETCJR50: { name: 'ETC Source Four Jr 50°', shape: 'profile', beam: 50, lamp: true, scale: 0.7 },
  ETC50: { name: 'ETC Source Four 50° (переносной)', shape: 'profile', beam: 50, lamp: true, scale: 0.85, note: 'прострел по планшету; число и места меняются от спектакля к спектаклю' },
  // --- Камерная сцена (добавлены в конец для сохранения цветов чертежа) ------
  BEYE640: { name: 'Anzhee H6x40Z B-EYE', shape: 'beam', beam: 22, scale: 0.9 },
  RAVEN150: { name: 'PROCBET RAVEN SPOT 150', shape: 'spot', beam: 15, scale: 0.78 },
  SPARROW: { name: 'Anzhee PROCBET SPARROW Wash RGBW', shape: 'wash', beam: 28, scale: 0.8 },
  FRESNEL100: { name: 'Anzhee Fresnel 100 Q ZOOM (WW+CW)', shape: 'fresnel', beam: 35, scale: 0.82 },
  PROF100_CW: { name: 'Anzhee Profile 100 (WW/CW)', shape: 'profile', beam: 26, scale: 0.8 },
  PROF100_RGB: { name: 'Anzhee Profile 100 (RGBALC)', shape: 'profile', beam: 26, scale: 0.8 },
  P7X40: { name: 'Anzhee PROCBET P7x40 RGBW ZOOM', shape: 'ledpar', beam: 25, scale: 0.75 },
  LEDBAR24: { name: 'Anzhee LedBar 24-15', shape: 'ledpar', beam: 35, scale: 0.85 },
  SVETOCH1000: { name: 'Светоч Fr-1000', shape: 'fresnel', beam: 32, lamp: true, scale: 0.95 },
  COMPC500: { name: 'SpotLight ComPC-500', shape: 'fresnel', beam: 30, lamp: true, scale: 0.8 },
  ETCJR_ZOOM: { name: 'ETC Source Four Jr Zoom (25–50°)', shape: 'profile', beam: 36, lamp: true, scale: 0.72 },
  ETCJR36: { name: 'ETC Source Four Jr 36°', shape: 'profile', beam: 36, lamp: true, scale: 0.7 },
  ETC_50: { name: 'ETC Source Four 50°', shape: 'profile', beam: 50, lamp: true, scale: 0.85 },
  // --- Сцена под крышей (только добавлять в конец: порядок = палитра цветов чертежа) ------
  LEDPAR933: { name: 'Involight LedPar 933', shape: 'ledpar', beam: 25, scale: 0.7 },
};

/**
 * Типы площадки = справочник + её собственные (например, «тип пока не уточнён»).
 * Собственные добавляются в конец, чтобы не сбить цвета корпусов справочных типов.
 */
export function venueTypes(localTypes = {}) {
  return { ...TYPES, ...localTypes };
}

import { describe, it, expect } from 'vitest';
import { RIGGING } from '../../src/venues/fest-big/config/rigging.js';
import { FIXTURES } from '../../src/venues/fest-big/config/fixtures.js';
import { DxfWriter, encodeDxfWindows1251 } from '../../src/export/dxfWriter.js';
import { buildPlanDXF, buildSectionDXF } from '../../src/venues/fest-big/export/dxf2d.js';
import { build3DDXF, buildGLB } from '../../src/venues/fest-big/export/export3d.js';
import { ALL_TRUSSES } from '../../src/venues/fest-chamber/config/dimensions.js';
import { FIXTURES as CHAMBER_FIXTURES } from '../../src/venues/fest-chamber/config/fixtures.js';
import { buildPlanDXF as buildChamberPlanDXF, buildSectionDXF as buildChamberSectionDXF } from '../../src/venues/fest-chamber/export/dxf2d.js';
import { build3DDXF as buildChamber3DDXF, buildGLB as buildChamberGLB, buildExportSceneForGLTF as buildChamberExportSceneForGLTF } from '../../src/venues/fest-chamber/export/export3d.js';
import roofVenue from '../../src/venues/fest-roof/index.js';
import { FIXTURES as ROOF_FIXTURES } from '../../src/venues/fest-roof/config/fixtures.js';
import { buildPlanDXF as buildRoofPlanDXF, buildSectionDXF as buildRoofSectionDXF } from '../../src/venues/fest-roof/export/dxf2d.js';
import { build3DDXF as buildRoof3DDXF, buildGLB as buildRoofGLB, buildExportSceneForGLTF as buildRoofExportScene } from '../../src/venues/fest-roof/export/export3d.js';

describe('Ядро генератора DXF (DxfWriter)', () => {
  it('формирует валидные секции HEADER ($INSUNITS=6, $DWGCODEPAGE=ANSI_1251), TABLES, BLOCKS, ENTITIES, EOF и кодирует Windows-1251', () => {
    const dxf = new DxfWriter({ insUnits: 6 });
    dxf.addLayer('TEST_LAYER', { color: 3, ltype: 'DASHED' });
    dxf.addLine(-5, -2, 10, 8, { layer: 'TEST_LAYER' });
    dxf.addCircle(0, 0, 2.5, { layer: 'TEST_LAYER' });
    dxf.addText(1, 2, 'Тестовая подпись', { layer: 'TEST_LAYER', height: 0.25, align: 'center' });

    const str = dxf.toString();
    expect(str).toContain('SECTION\n2\nHEADER');
    expect(str).toContain('$DWGCODEPAGE\n3\nANSI_1251');
    expect(str).toContain('$INSUNITS\n70\n6');
    expect(str).toContain('SECTION\n2\nTABLES');
    expect(str).toContain('arial.ttf');
    expect(str).toContain('TEST_LAYER');
    expect(str).toContain('SECTION\n2\nBLOCKS');
    expect(str).toContain('SECTION\n2\nENTITIES');
    expect(str.trim().endsWith('0\nEOF')).toBe(true);

    // Проверяем кодировку Windows-1251 и отсутствие не-ASCII байтов в первых 8192 байтах
    const bytes = encodeDxfWindows1251(str);
    expect(bytes).toBeInstanceOf(Uint8Array);
    for (let i = 0; i < Math.min(8192, bytes.length); i++) {
      expect(bytes[i]).toBeLessThan(128);
    }
    const decoded = new TextDecoder('windows-1251').decode(bytes);
    expect(decoded).toContain('Тестовая подпись');
  });
});

describe('Экспорт 2D-плана сцены (buildPlanDXF)', () => {
  it('содержит все целевые слои, все 20 подъёмов механики и все 116 постоянных приборов без световых лучей и кругов', () => {
    const dxf = buildPlanDXF(null);
    for (const layer of [
      '0_AXES', '0_GRID', 'AR_WALLS', 'AR_RIGEL', 'AR_GALLERIES', 'AR_HALL',
      'RIG_BATTENS', 'RIG_SOFFITS', 'RIG_TRACK', 'RIG_SIDE',
      'FIXTURES', 'FIXTURE_LABELS',
      'DIMS', 'SHEET_LEGEND',
    ]) {
      expect(dxf, `отсутствует слой ${layer}`).toContain(`\n2\n${layer}\n`);
    }
    // Слои лучей, пятен и разделения вкл/выкл полностью отсутствуют
    expect(dxf).not.toContain('LIGHT_FIXTURES');
    expect(dxf).not.toContain('LIGHT_FIXTURES_OFF');
    expect(dxf).not.toContain('LIGHT_AIM');
    expect(dxf).not.toContain('LIGHT_BEAMS');

    for (const r of RIGGING) {
      expect(dxf, `отсутствует подъём ${r.name}`).toContain(r.name);
    }
    // Проверяем блоки приборов: 116 постоянных приборов на едином слое FIXTURES
    const inserts = (dxf.match(/\n0\nINSERT\n/g) || []).length;
    expect(inserts).toBe(116);
  });

  it('отражает изменение состояния высот и переносных приборов, сохраняя все приборы в выключенном виде на слое FIXTURES', () => {
    const mockStage = {
      rigging: {
        height: (id) => (id === 'Sh3' ? 2.45 : RIGGING.find((r) => r.id === id).rest),
      },
      fixtures: {
        portable: { mode: 'stand', count: 8 },
        list: FIXTURES.map((f, i) => ({ ...f, idx: i, on: i >= 10, hidden: false })),
      },
    };
    const dxf = buildPlanDXF(mockStage);
    expect(dxf).toContain('Ш3 (d=2,65, H=+2,45)');
    expect(dxf).toContain('\n8\nFIXTURES\n');
    expect(dxf).not.toContain('LIGHT_FIXTURES_OFF');
    // 116 постоянных + 8 переносных = 124 блока INSERT
    const inserts = (dxf.match(/\n0\nINSERT\n/g) || []).length;
    expect(inserts).toBe(124);
  });

  it('строит линии передних лестниц авансцены строго параллельно скосу (без схождения в одну точку у портала)', () => {
    const dxf = buildPlanDXF(null);
    // Правый скос авансцены: от (6.25, 0) до (5.625, -0.85) -> наклон dx/dy = (5.625 - 6.25) / -0.85
    const expectedSlope = (5.625 - 6.25) / -0.85;
    // Извлекаем все LINE на слое AR_WALLS, у которых y1 = 0 и x2 = 5.625 (правый марш лестницы)
    const lineBlocks = dxf.split('\n0\nLINE\n').slice(1);
    const rightStairLines = [];
    for (const blk of lineBlocks) {
      const lines = blk.split('\n');
      const map = {};
      for (let i = 0; i + 1 < lines.length; i += 2) {
        if (lines[i] === '0') break;
        map[lines[i]] = lines[i + 1];
      }
      if (map['8'] === 'AR_WALLS' && Number(map['20']) === 0 && Math.abs(Number(map['11']) - 5.625) < 1e-3 && Number(map['21']) < -0.85) {
        rightStairLines.push({ x1: Number(map['10']), y1: Number(map['20']), x2: Number(map['11']), y2: Number(map['21']) });
      }
    }
    expect(rightStairLines.length).toBe(4);
    const x1Set = new Set(rightStairLines.map((l) => l.x1));
    expect(x1Set.size).toBe(4); // все 4 ступени приходят в разные точки на линии портала d=0
    for (const l of rightStairLines) {
      const slope = (l.x2 - l.x1) / (l.y2 - l.y1);
      expect(slope).toBeCloseTo(expectedSlope, 3);
    }
  });
});

describe('Экспорт 2D продольного разреза (buildSectionDXF)', () => {
  it('содержит высотные отметки, ригель, гребёнку зала и динамически обновляет высоты подъёмов без лучей света', () => {
    const mockStage = {
      rigging: {
        height: (id) => (id === 'C2' ? 3.15 : RIGGING.find((r) => r.id === id).rest),
      },
      fixtures: {
        portable: { mode: 'floor', count: 6 },
        list: FIXTURES.map((f, i) => ({ ...f, idx: i, on: true, hidden: false })),
      },
    };
    const dxf = buildSectionDXF(mockStage);
    expect(dxf).toContain('±0,000 (Планшет)');
    expect(dxf).toContain('+6,400 (Низ ригеля)');
    expect(dxf).toContain('+8,500 (Потолок сцены)');
    expect(dxf).toContain('С2 (+3,15)');
    expect(dxf).toContain('Переносные ETC 50° (6 шт., на полу +0,24 м)');
    expect(dxf).toContain('\n2\nFIXTURES_SECTION\n');
    expect(dxf).not.toContain('LIGHT_BEAMS');
  });
});

describe('Экспорт 3D DXF (build3DDXF)', () => {
  it('генерирует 3DFACE и LINE в координатах AutoCAD WCS (Z = высота), скрывает внешние стены на 3D_OUTER_WALLS и не содержит лучей', () => {
    const dxf = build3DDXF(null);
    expect(dxf).toContain('\n0\n3DFACE\n');
    expect(dxf).toContain('\n2\n3D_WALLS\n');
    expect(dxf).toContain('\n2\n3D_OUTER_WALLS\n');
    expect(dxf).toContain('\n2\n3D_RIG_COUNTERWEIGHTS\n');
    expect(dxf).toContain('\n2\n3D_FIXTURES\n');
    expect(dxf).not.toContain('3D_LIGHT_RAYS');
    expect(dxf).not.toContain('3D_FIXTURES_OFF');
    expect(dxf.trim().endsWith('0\nEOF')).toBe(true);
  });
});

describe('Экспорт 3D-модели Binary glTF 2.0 (buildGLB)', () => {
  it('создаёт валидный бинарный контейнер GLB v2 с односторонними внешними стенками (doubleSided: false) и без NaN', async () => {
    const buf = await buildGLB(null);
    expect(buf).toBeInstanceOf(ArrayBuffer);
    expect(buf.byteLength).toBeGreaterThan(50_000);

    const dv = new DataView(buf);
    // Magic 'glTF' = 0x46546C67, version = 2
    expect(dv.getUint32(0, true)).toBe(0x46546C67);
    expect(dv.getUint32(4, true)).toBe(2);
    expect(dv.getUint32(8, true)).toBe(buf.byteLength);

    // Чанк 0: JSON (0x4E4F534A)
    const jsonLen = dv.getUint32(12, true);
    const jsonType = dv.getUint32(16, true);
    expect(jsonType).toBe(0x4E4F534A);
    expect(jsonLen % 4).toBe(0);

    const jsonStr = new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen));
    const gltf = JSON.parse(jsonStr);
    expect(gltf.asset.version).toBe('2.0');
    expect(gltf.meshes.length).toBeGreaterThan(20);
    expect(gltf.nodes.length).toBeGreaterThan(20);

    // Все материалы в GLB должны быть односторонними (без doubleSided: true), чтобы внешние стены были прозрачны снаружи
    for (const mat of gltf.materials || []) {
      expect(mat.doubleSided).not.toBe(true);
    }

    // Проверка отсутствия NaN/Infinity в min/max всех accessors
    for (const acc of gltf.accessors) {
      if (acc.min) for (const v of acc.min) expect(Number.isFinite(v)).toBe(true);
      if (acc.max) for (const v of acc.max) expect(Number.isFinite(v)).toBe(true);
    }
  });
});

describe('Камерная сцена: экспорт 2D и 3D (DXF и GLB)', () => {
  it('2D-план (buildChamberPlanDXF) содержит все целевые слои, 12 ферм и 72 блока приборов', () => {
    const dxf = buildChamberPlanDXF(null);
    for (const layer of [
      '0_AXES', '0_GRID', 'AR_WALLS', 'AR_RIGEL', 'AR_DUCTS', 'AR_HALL', 'AR_HALL_SEATS',
      'TRUSSES', 'TRUSS_EQUIPMENT', 'FIXTURES', 'FIXTURE_LABELS', 'DIMS', 'SHEET_LEGEND',
    ]) {
      expect(dxf, `отсутствует слой ${layer}`).toContain(`\n2\n${layer}\n`);
    }
    for (const tr of ALL_TRUSSES) {
      expect(dxf, `отсутствует ферма ${tr.name}`).toContain(tr.name);
    }
    const inserts = (dxf.match(/\n0\nINSERT\n/g) || []).length;
    expect(inserts).toBe(CHAMBER_FIXTURES.length);
  });

  it('2D продольный разрез (buildChamberSectionDXF) содержит высотные отметки, гребёнку зала и операторскую', () => {
    const dxf = buildChamberSectionDXF(null);
    expect(dxf).toContain('±0,000 (Планшет сцены)');
    expect(dxf).toContain('+1,500 (7-й ряд / Операторская)');
    expect(dxf).toContain('+3,600 (Низ ригелей)');
    expect(dxf).toContain('+3,750 (Низ ферм)');
    expect(dxf).toContain('+4,400 (Потолок)');
    expect(dxf).toContain('Операторская (+1,50)');
    expect(dxf).toContain('\n2\nFIXTURES_SECTION\n');
  });

  it('3D DXF (buildChamber3DDXF) генерирует 3DFACE и LINE в AutoCAD WCS и скрывает внешние стены на 3D_OUTER_WALLS', () => {
    const dxf = buildChamber3DDXF(null);
    expect(dxf).toContain('\n0\n3DFACE\n');
    expect(dxf).toContain('\n2\n3D_WALLS\n');
    expect(dxf).toContain('\n2\n3D_OUTER_WALLS\n');
    expect(dxf).toContain('\n2\n3D_TRUSSES\n');
    expect(dxf).toContain('\n2\n3D_FIXTURES\n');
    expect(dxf.trim().endsWith('0\nEOF')).toBe(true);
  });

  it('3D GLB (buildChamberGLB) создаёт валидный бинарный контейнер glTF 2.0 с односторонними материалами и без NaN', async () => {
    const buf = await buildChamberGLB(null);
    expect(buf).toBeInstanceOf(ArrayBuffer);
    expect(buf.byteLength).toBeGreaterThan(20_000);
    const dv = new DataView(buf);
    expect(dv.getUint32(0, true)).toBe(0x46546C67);
    expect(dv.getUint32(4, true)).toBe(2);
    const jsonLen = dv.getUint32(12, true);
    const gltf = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, jsonLen)));
    expect(gltf.asset.version).toBe('2.0');
    for (const mat of gltf.materials || []) {
      expect(mat.doubleSided).not.toBe(true);
    }
    for (const acc of gltf.accessors) {
      if (acc.min) for (const v of acc.min) expect(Number.isFinite(v)).toBe(true);
      if (acc.max) for (const v of acc.max) expect(Number.isFinite(v)).toBe(true);
    }

    // Проверяем экспортную сцену GLB: короба входят в Architecture_Walls_Columns_Ducts
    // и не содержат наружных граней по x = -8.35
    const root = buildChamberExportSceneForGLTF(null);
    const archGroup = root.getObjectByName('Architecture_Walls_Columns_Ducts');
    expect(archGroup).toBeTruthy();
    let outerLeftDuctFaces = 0;
    archGroup.traverse((o) => {
      if (!o.isMesh || !o.geometry) return;
      const pos = o.geometry.attributes.position;
      const nor = o.geometry.attributes.normal;
      for (let i = 0; i < pos.count; i += 3) {
        const xs = [pos.getX(i), pos.getX(i + 1), pos.getX(i + 2)];
        const zs = [pos.getZ(i), pos.getZ(i + 1), pos.getZ(i + 2)];
        const minX = Math.min(...xs);
        const minD = Math.min(-zs[0], -zs[1], -zs[2]), maxD = Math.max(-zs[0], -zs[1], -zs[2]);
        const nx = (nor.getX(i) + nor.getX(i + 1) + nor.getX(i + 2)) / 3;
        // Венткороб d = 2.80..6.10: не должно быть граней по x = -8.35 с нормалью -X
        if (maxD >= 2.80 && minD <= 6.10 && minX <= -7.74 && Math.abs(minX - (-8.35)) < 0.01 && nx < -0.9) {
          outerLeftDuctFaces++;
        }
      }
    });
    expect(outerLeftDuctFaces).toBe(0);
  });
});

describe('Сцена под крышей: экспорт 2D и 3D (DXF и GLB) с текущей планировкой зала', () => {
  /** Фиктивный stage: площадка, планировка, приборы. */
  const stageOf = (layout) => ({ venue: roofVenue, layout, fixtures: { list: ROOF_FIXTURES.map((f) => ({ ...f, on: true })) } });
  const std = { id: 'std', rows: 5, shift: 0 };
  /** Сущности DXF (разбор парами «код — значение»): тип, слой, коды Z. */
  const ents = (dxf) => {
    const L = dxf.split('\n').map((s) => s.trim());
    let i = L.indexOf('ENTITIES') + 1;
    const out = [];
    let cur = null;
    for (; i + 1 < L.length; i += 2) {
      const code = L[i], val = L[i + 1];
      if (code === '0') { if (val === 'ENDSEC') break; cur = { type: val, layer: null, z: [] }; out.push(cur); }
      else if (cur && code === '8') cur.layer = val;
      else if (cur && /^3[0-3]$/.test(code)) cur.z.push(+val);
    }
    return out;
  };
  const count = (dxf, type, layer) => ents(dxf).filter((e) => e.type === type && e.layer === layer).length;

  it('план: все слои, 49 блоков приборов, 20 куполов, std — 90 мест (блоки SEATS)', () => {
    const dxf = buildRoofPlanDXF(stageOf(std));
    for (const layer of ['WALLS', 'DOORS', 'COLUMNS', 'CAPITAL', 'DIAGONALS', 'VFRAMES', 'TRUSSES', 'LEGS', 'DOMES', 'MOLTON', 'STANDS', 'SEATS', 'PULTS', 'FIXTURES', 'DIMS', 'TEXT']) {
      expect(dxf, `слой ${layer}`).toContain(`\n2\n${layer}\n`);
    }
    expect(count(dxf, 'INSERT', 'FIXTURES')).toBe(49);
    expect(count(dxf, 'INSERT', 'DOMES')).toBe(20);
    expect(count(dxf, 'INSERT', 'SEATS')).toBe(90);
    expect(ents(dxf).filter((e) => e.layer === 'STANDS').length).toBeGreaterThan(0);
    expect(dxf.trim().endsWith('0\nEOF')).toBe(true);
  });

  it('план после смены планировки: traverse — 84 места; empty — 0, слои STANDS/SEATS/PULTS пустые', () => {
    expect(count(buildRoofPlanDXF(stageOf({ id: 'traverse', rows: 3, shift: 0 })), 'INSERT', 'SEATS')).toBe(84);
    const empty = buildRoofPlanDXF(stageOf({ id: 'empty', rows: 0, shift: 0 }));
    for (const layer of ['STANDS', 'SEATS', 'PULTS']) {
      expect(empty, `слой ${layer} объявлен`).toContain(`\n2\n${layer}\n`);
      expect(ents(empty).filter((e) => e.layer === layer).length, layer).toBe(0);
    }
    // без stage — планировка по умолчанию
    expect(count(buildRoofPlanDXF(null), 'INSERT', 'SEATS')).toBe(90);
  });

  it('разрез: отметки 3,15 / 3,45 / 4,45 / 4,70, гребёнка станков', () => {
    const dxf = buildRoofSectionDXF(stageOf(std));
    for (const t of ['±0,000', '+3,150', '+3,450', '+4,450', '+4,700']) expect(dxf, t).toContain(t);
    expect(ents(dxf).filter((e) => e.layer === 'STANDS').length).toBeGreaterThanOrEqual(4);
    expect(dxf).toContain('\n2\nFIXTURES\n');
  });

  it('3D DXF: 3DFACE и LINE в WCS (Z — высота), внешние стены на 3D_OUTER_WALLS', () => {
    const dxf = buildRoof3DDXF(stageOf(std));
    expect(dxf).toContain('\n0\n3DFACE\n');
    for (const layer of ['3D_OUTER_WALLS', '3D_WALLS', '3D_CEILING', '3D_TRUSSES', '3D_HALL', '3D_FIXTURES']) expect(dxf, layer).toContain(`\n2\n${layer}\n`);
    expect(count(dxf, '3DFACE', '3D_OUTER_WALLS')).toBeGreaterThan(0);
    expect(count(dxf, '3DFACE', '3D_HALL')).toBeGreaterThan(0);
    // Z (коды 30–33 у 3DFACE) — высота: в пределах пол…потолок; торцы наклонных ног V-косынок
    // (брус 0,15) уходят под пол не глубже 0,05
    const zs = ents(dxf).filter((e) => e.type === '3DFACE').flatMap((e) => e.z);
    expect(zs.length).toBeGreaterThan(0);
    expect(Math.min(...zs)).toBeGreaterThanOrEqual(-0.05);
    expect(Math.max(...zs)).toBeLessThanOrEqual(4.71);
    expect(dxf.trim().endsWith('0\nEOF')).toBe(true);
  });

  it('GLB: валидный glTF 2.0, односторонние материалы, без NaN; зал — по текущей планировке', async () => {
    const buf = await buildRoofGLB(stageOf(std));
    expect(buf).toBeInstanceOf(ArrayBuffer);
    const dv = new DataView(buf);
    expect(dv.getUint32(0, true)).toBe(0x46546C67);
    expect(dv.getUint32(4, true)).toBe(2);
    const gltf = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 20, dv.getUint32(12, true))));
    expect(gltf.asset.version).toBe('2.0');
    for (const mat of gltf.materials || []) expect(mat.doubleSided, mat.name).not.toBe(true);
    for (const acc of gltf.accessors) for (const v of [...(acc.min || []), ...(acc.max || [])]) expect(Number.isFinite(v)).toBe(true);
    const names = (s) => { const out = []; s.traverse((o) => out.push(o.name)); return out; };
    expect(names(buildRoofExportScene(stageOf(std)))).toContain('Seats_90');
    expect(names(buildRoofExportScene(stageOf({ id: 'arena', rows: 3, shift: 0 })))).toContain('Seats_82');
  });
});

import { describe, it, expect } from 'vitest';
import { RIGGING } from '../../src/config/rigging.js';
import { FIXTURES } from '../../src/config/fixtures.js';
import { DxfWriter, encodeDxfWindows1251 } from '../../src/export/dxfWriter.js';
import { buildPlanDXF, buildSectionDXF } from '../../src/export/dxf2d.js';
import { build3DDXF, buildGLB } from '../../src/export/export3d.js';

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

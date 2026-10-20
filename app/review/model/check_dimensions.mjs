import { DIM } from '../../src/config/dimensions.js';
import { RIGGING, SPACING, DEPTHS, LEFT_RAIL_ORDER, RIG_BY_ID } from '../../src/config/rigging.js';
import { FIXTURES, TYPES, GROUPS, INVENTORY, countByType } from '../../src/config/fixtures.js';

console.log('=== СВЕРКА РАЗМЕРОВ И КОНФИГУРАЦИИ ===\n');

// 1. Коробка сцены
console.log('1. Коробка сцены:');
console.log(`- Ширина: в тех. файле 15.5 м -> в модели DIM.box.width = ${DIM.box.width} м (расхождение +1.5 м из-за длины штанкетов 14 м и галерей 0.9 м: 14 + 2*0.9 = 15.8 > 15.5)`);
console.log(`- Высота до потолка: в тех. файле 8.5 м -> в модели ${DIM.box.ceiling} м`);
console.log(`- Глубина до задней стены от края авансцены: в тех. файле 12 м -> в модели ${DIM.forestage.depth + DIM.box.backWallD} м (авансцена 2.75 + сцена 9.2 = 11.95 м, расхождение -0.05 м)`);

// 2. Портал и авансцена
console.log('\n2. Портал и авансцена:');
console.log(`- Ширина портала: в тех. файле 12.5 м -> в модели ${DIM.portal.width} м`);
console.log(`- Высота портала: в тех. файле 5.15 м -> в модели ${DIM.portal.height} м`);
console.log(`- Толщина портала: в тех. файле 0.25 м -> в модели ${DIM.portal.thickness} м`);
console.log(`- Глубина авансцены: в тех. файле 2.75 м -> в модели ${DIM.forestage.depth} м`);
console.log(`- Ширина переда авансцены: в тех. файле 11.25 м -> в модели ${DIM.forestage.frontWidth} м`);
console.log(`- Высота сцены над залом: в тех. файле 0.75 м -> в модели ${DIM.forestage.height} м`);
console.log(`- Лестницы авансцены: в тех. файле длинная сторона 3.75 м -> в модели ${DIM.forestage.stairs.longSide} м, ступеней ${DIM.forestage.stairs.steps}`);
console.log(`- Потолок над авансценой: в тех. файле 6.1 м -> в модели ${DIM.decoCeilingY} м`);

// 3. Галереи
console.log('\n3. Галереи:');
console.log(`- Ширина галерей: в тех. файле 0.9 м -> в модели ${DIM.galleries.width} м`);
console.log(`- Высота нижней галереи: в тех. файле 2.2 м -> в модели ${DIM.galleries.lowerY} м`);
console.log(`- Высота нижней галереи над воротами: в тех. файле 2.9 м -> в модели ${DIM.galleries.overGateY} м`);
console.log(`- Высота верхней галереи (зад и бока): в тех. файле 5.7 м -> в модели ${DIM.galleries.upperY} м`);
console.log(`- Высота передней верхней галереи: в тех. файле 6.2 м -> в модели ${DIM.galleries.frontY} м`);
console.log(`- Площадка узла подъема: в тех. файле 2х2 м -> в модели ${DIM.liftNode.padSize}x${DIM.liftNode.padSize} м на высоте ${DIM.liftNode.padY} м`);

// 4. Проёмы
console.log('\n4. Проемы:');
console.log(`- Ворота сзади: в тех. файле 3 м -> в модели ширина ${DIM.openings.gate.width} м, высота ${DIM.openings.gate.height} м, центр X=${DIM.openings.gate.centerX}`);
console.log(`- Дверь сзади слева: в тех. файле 0.9 м -> в модели ширина ${DIM.openings.backDoor.width} м, высота ${DIM.openings.backDoor.height} м, центр X=${DIM.openings.backDoor.centerX}`);

// 5. Ригель
console.log('\n5. Ригель:');
console.log(`- Ширина балки: в тех. файле 0.3 м -> в модели ${DIM.rigel.width} м`);
console.log(`- Высота низа над планшетом: в тех. файле 6.4 м -> в модели ${DIM.rigel.bottomY} м`);
console.log(`- Выступ от потолка: в тех. файле 2.1 м -> в модели ${DIM.box.ceiling - DIM.rigel.bottomY} м`);

// 6. Ходы и параметры механики
console.log('\n6. Механика (ходы и параметры):');
for (const r of RIGGING) {
  console.log(`- ${r.id} (${r.kind}): d=${r.d ?? `${r.dFrom}..${r.dTo}`}, ход=${r.min}..${r.max} м, исх=${r.rest} м, упр=${r.control}, подвесов=${r.lines}`);
}

// 7. Расстояния между осями
console.log('\n7. Расстояния между осями (тех. файл vs модель):');
for (const [a, b, gap] of SPACING) {
  console.log(`  ${a} -> ${b}: ${gap} м`);
}

// 8. Приборы
console.log('\n8. Подсчет приборов по типам:');
const counts = {};
for (const f of FIXTURES) {
  counts[f.type] = (counts[f.type] || 0) + 1;
}
console.log('Фактически в массиве FIXTURES:', counts);
console.log('Всего приборов в FIXTURES:', FIXTURES.length);
const perGroup = {};
for (const f of FIXTURES) {
  perGroup[f.group] = (perGroup[f.group] || 0) + 1;
}
console.log('Приборов по группам:', perGroup);

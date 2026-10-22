// =============================================================================
//  ШАБЛОН «ЧЁРНЫЙ КАБИНЕТ» — параметрический построитель площадки без портала
//  и без подвижной механики: коробка зала, ряды кресел, неподвижные треугольные фермы.
//  Как сделать новую площадку — README.md рядом. Пример — venues/fest-chamber/.
// =============================================================================
export { buildBlackBox, buildSeats, buildEmitters, trussGeometry, tubeBetween } from './build.js';
export { blackBoxViews, blackBoxDims, blackBoxGrid, blackBoxOverlays, blackBoxAmbient } from './overlays.js';
export { trussDs, trussXRange, trussChords, trussTopY, triHeight, hangerXs, rowFrontD, rowFloorY, seatCount, seatLayout, lastRowBackD } from './layout.js';

import type { IndoorGroup } from "./lighting/contracts";
export const modernLayout = {
  x: 0,
  y: 0,
  width: 1448,
  height: 1086,
  viewBox: "0 0 1448 1086",
};
const point = (x: number, y: number) => [x / 15.96, y / 14.22];
export const modernAreas = {
  house: {
    shape: "202,110 612,20 1004,168 1070,328 1060,688 222,690",
    point: point(595, 385),
  },
  floor: { shape: "221,561 1070,570 1070,685 222,690", point: point(460, 610) },
  pool: {
    shape: "38,736 222,692 1126,713 1152,840 38,794",
    point: point(640, 772),
  },
  charging: {
    shape: "1190,580 1335,580 1340,722 1210,722",
    point: point(1280, 650),
  },
};
export const modernIndoorGroups: {
  id: IndoorGroup;
  name: string;
  count: number;
  window: string;
  spots: [number, number][];
}[] = [
  {
    id: "large-left",
    name: "Stort fönster nedervåning",
    count: 3,
    window: "223,414 498,403 499,652 222,654",
    spots: [
      [263, 432],
      [357, 428],
      [454, 425],
    ],
  },
  {
    id: "large-right",
    name: "Stort fönster övervåning",
    count: 3,
    window: "218,163 496,113 498,363 220,376",
    spots: [
      [255, 169],
      [350, 152],
      [455, 132],
    ],
  },
  {
    id: "above-table",
    name: "Fönster ovanför bordet",
    count: 2,
    window: "735,183 883,174 885,331 734,340",
    spots: [
      [770, 195],
      [849, 188],
    ],
  },
  {
    id: "behind-table",
    name: "Fönster bakom bordet",
    count: 2,
    window: "733,414 882,411 882,636 733,636",
    spots: [
      [766, 431],
      [843, 429],
    ],
  },
  {
    id: "table-pergola",
    name: "Matplats under pergolan",
    count: 2,
    window: "716,391 1084,374 1093,424 720,441",
    spots: [
      [792, 409],
      [1013, 399],
    ],
  },
];
export const modernSpots = [
  ...[
    [539, 478],
    [670, 468],
    [912, 480],
    [1017, 495],
  ].map(([x, y], i) => ({ id: `facade-${i + 1}`, x, y, kind: "wall" })),
  ...[
    [1258, 589],
    [1360, 668],
    [1374, 756],
    [1411, 818],
  ].map(([x, y], i) => ({ id: `right-${i}`, x, y, kind: "right" })),
  ...[
    [309, 975],
    [525, 982],
    [752, 1002],
    [977, 1039],
  ].map(([x, y], i) => ({ id: `garden-${i}`, x, y, kind: "garden" })),
];
export const modernPoolLamp = { x: 679, y: 720 };

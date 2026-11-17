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
    shape: "441,321 778,317 1093,293 1154,507 1140,755 443,750",
    point: point(756, 445),
  },
  floor: { shape: "443,630 1146,625 1140,751 443,748", point: point(680, 671) },
  pool: { shape: "365,842 500,750 1113,765 1092,871", point: point(770, 807) },
  charging: {
    shape: "1210,570 1340,570 1355,736 1218,736",
    point: point(1280, 635),
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
    window: "451,557 684,557 684,716 451,717",
    spots: [
      [480, 570],
      [565, 570],
      [650, 570],
    ],
  },
  {
    id: "large-right",
    name: "Stort fönster övervåning",
    count: 3,
    window: "451,368 684,356 684,529 451,530",
    spots: [
      [480, 380],
      [565, 377],
      [650, 372],
    ],
  },
  {
    id: "above-table",
    name: "Fönster ovanför bordet",
    count: 2,
    window: "844,350 971,350 971,487 844,487",
    spots: [
      [875, 365],
      [942, 365],
    ],
  },
  {
    id: "behind-table",
    name: "Fönster bakom bordet",
    count: 2,
    window: "847,552 968,553 968,689 847,689",
    spots: [
      [876, 564],
      [941, 565],
    ],
  },
  {
    id: "table-pergola",
    name: "Matplats under pergolan",
    count: 2,
    window: "819,496 1153,489 1153,554 817,550",
    spots: [
      [890, 520],
      [1080, 517],
    ],
  },
];
export const modernSpots = [
  ...[
    [718, 611],
    [809, 594],
    [991, 592],
    [1090, 610],
  ].map(([x, y], i) => ({ id: `facade-${i + 1}`, x, y, kind: "wall" })),
  ...[
    [1310, 615],
    [1335, 714],
    [1384, 811],
    [1426, 903],
  ].map(([x, y], i) => ({ id: `right-${i}`, x, y, kind: "right" })),
];
export const modernPoolLamp = { x: 824, y: 771 };

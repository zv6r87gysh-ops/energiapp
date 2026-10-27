import type { IndoorGroup } from "./contracts";
// Window regions calibrated against the retained house photo, in reference coordinates.
export const indoorGroups: {
  id: IndoorGroup;
  name: string;
  count: number;
  window: string;
  spots: [number, number][];
}[] = [
  {
    id: "large-left",
    name: "Stort fönster vänster",
    count: 3,
    window: "316,403 417,438 417,594 319,561",
    spots: [
      [337, 431],
      [367, 442],
      [398, 453],
    ],
  },
  {
    id: "large-right",
    name: "Stort fönster höger",
    count: 3,
    window: "531,480 665,526 665,674 532,624",
    spots: [
      [554, 507],
      [592, 521],
      [634, 537],
    ],
  },
  {
    id: "above-table",
    name: "Fönster ovanför bordet",
    count: 2,
    window: "872,488 962,516 962,641 872,602",
    spots: [
      [891, 520],
      [935, 534],
    ],
  },
  {
    id: "behind-table",
    name: "Fönster bakom bordet",
    count: 2,
    window: "1048,660 1116,616 1116,780 1048,826",
    spots: [
      [1065, 677],
      [1099, 654],
    ],
  },
];

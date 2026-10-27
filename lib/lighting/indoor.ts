import type { IndoorGroup } from "./contracts";
// Reference coordinates shared with the original house photo layout.
// Revised against the user's yellow/red/blue annotation: no upper-left window light.
export const indoorGroups: {
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
    window: "532,668 665,712 665,840 532,791",
    spots: [
      [551, 694],
      [593, 708],
      [636, 722],
    ],
  },
  {
    id: "large-right",
    name: "Stort fönster övervåning",
    count: 3,
    window: "531,480 665,526 665,674 532,624",
    spots: [
      [550, 503],
      [593, 518],
      [638, 534],
    ],
  },
  {
    id: "above-table",
    name: "Fönster ovanför bordet",
    count: 2,
    window: "872,488 962,516 962,641 872,602",
    spots: [
      [891, 513],
      [939, 529],
    ],
  },
  {
    id: "behind-table",
    name: "Fönster bakom bordet",
    count: 2,
    // Visible glass below the diagonal pergola beam: the slats and fascia stay dark.
    window: "1048,748 1116,686 1116,780 1048,826",
    spots: [
      [1064, 756],
      [1099, 724],
    ],
  },
  {
    id: "table-pergola",
    name: "Matplats under pergolan",
    count: 2,
    // Underside/back wall beneath the slats in the second red annotation.
    window: "805,750 955,801 955,851 805,800",
    spots: [
      [834, 775],
      [916, 803],
    ],
  },
];

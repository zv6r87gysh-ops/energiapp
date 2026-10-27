// Coordinates on the original 1596 × 1422 house photo, not the annotated screenshot's frame.
// Warm downlights on the facade/pergola, and ground spots along the three red-marked garden edges.
export const outdoorSpots = [
  { id: "facade-1", x: 684, y: 754, kind: "wall" },
  { id: "facade-2", x: 824, y: 704, kind: "wall" },
  { id: "facade-3", x: 969, y: 718, kind: "wall" },
  { id: "facade-4", x: 1183, y: 640, kind: "wall" },
  ...[
    [291, 932],
    [354, 866],
    [417, 800],
    [480, 740],
  ].map(([x, y], i) => ({ id: `left-${i}`, x, y, kind: "left" })),
  ...[
    [965, 989],
    [1037, 915],
    [1109, 838],
    [1180, 761],
    [1251, 686],
    [1322, 613],
  ].map(([x, y], i) => ({ id: `right-${i}`, x, y, kind: "right" })),
  ...[
    [62, 1227],
    [144, 1264],
    [226, 1301],
    [308, 1338],
    [390, 1375],
    [472, 1410],
  ].map(([x, y], i) => ({ id: `garden-${i}`, x, y, kind: "garden" })),
];

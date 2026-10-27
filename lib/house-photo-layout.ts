// The first chat image was a crop; the supplied original includes more garden around it.
const cropped = {
  x: 0,
  y: 0,
  width: 1596,
  height: 1422,
  viewBox: "0 0 1596 1422",
};
const scale = 0.713;
const original = {
  x: -199 / scale,
  y: -21 / scale,
  width: 1448 / scale,
  height: 1086 / scale,
  viewBox: `${-199 / scale} ${-21 / scale} ${1448 / scale} ${1086 / scale}`,
};
export function housePhotoLayout(width: number, height: number) {
  return width === 1448 && height === 1086 ? original : cropped;
}
export function photoPoint(
  point: readonly number[],
  layout: ReturnType<typeof housePhotoLayout>,
) {
  return [
    ((point[0] * 15.96 - layout.x) / layout.width) * 100,
    ((point[1] * 14.22 - layout.y) / layout.height) * 100,
  ];
}

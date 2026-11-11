// Keep a popup open when the user clicked a marker or dragged the map.
// Only a plain click on empty sky should dismiss it.
export function shouldDismissSkyPopup(
  clickedMarker: boolean,
  isDragging: boolean,
): boolean {
  return !clickedMarker && !isDragging;
}

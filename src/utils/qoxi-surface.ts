// qoxi: Apple-Home "on" tile. Only themes that define
// --qoxi-active-card-background opt in; every other theme keeps the
// ordinary card look.
export function qoxiActiveSurface(el: Element, active: boolean): boolean {
  if (!active) return false;
  return !!getComputedStyle(el)
    .getPropertyValue("--qoxi-active-card-background")
    .trim();
}

type ClickModifiers = {
  button: number;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
};

// Only intercept plain left-clicks on our own object detail links.
// Modified clicks and new-tab requests keep their native browser behavior.
export function popupObjectRoute(
  href: string | null,
  click: ClickModifiers,
  target: string,
): string | null {
  if (
    href === null ||
    !/^\/object\/\d+$/.test(href) ||
    click.button !== 0 ||
    click.altKey ||
    click.ctrlKey ||
    click.metaKey ||
    click.shiftKey ||
    (target !== "" && target !== "_self")
  ) {
    return null;
  }
  return href;
}

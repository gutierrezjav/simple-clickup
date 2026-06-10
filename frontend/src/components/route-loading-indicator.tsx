export function RouteLoadingIndicator({ isVisible }: { isVisible: boolean }) {
  if (!isVisible) {
    return null;
  }

  return <div aria-hidden="true" className="route-loading-indicator" />;
}

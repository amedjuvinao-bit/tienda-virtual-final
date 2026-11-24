export const JOURNEY_CONTROL_NAVIGATION = 'storefront:control-navigation';

// Both control docks announce their trip before scrolling. The scene keeps
// that choreography until a new native gesture hands the page to the reader.
export function announceJourneyControlNavigation(element) {
  const container = element?.closest('.storefront-sections');
  if (!container) return;
  const view = container.ownerDocument.defaultView;
  container.dispatchEvent(new view.CustomEvent(JOURNEY_CONTROL_NAVIGATION));
}

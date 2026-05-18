export const urbanPrimeEmptyAnimations = {
  loader: "/empty-states/loading-blue.gif",
  noResults: "/empty-states/no-results-found.gif",
  noChat: "/empty-states/no-file-found.gif",
  feedback: "/empty-states/empty-orders.png",
  reviews: "/empty-states/empty-wishlist.png",
} as const;

export type UrbanPrimeEmptyAnimation = keyof typeof urbanPrimeEmptyAnimations;

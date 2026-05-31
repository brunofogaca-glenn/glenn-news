export function getTopStories(news: any) {
  return [
    ...news.elfsborg.slice(0, 2),
    ...news.boras.slice(0, 1),
    ...news.sverige.slice(0, 1),
    ...news.varlden.slice(0, 1),
  ]
    .filter(Boolean)
    .slice(0, 10);
}

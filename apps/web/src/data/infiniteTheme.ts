import type { Gem } from '@gem-arena/engine';
import type { PreviewAppearance } from '../components/PreviewAppearance';
import manifest from '../assets/infinite/sources.json';

const assets = import.meta.glob('../assets/infinite/*.jpg', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const asset = (file: string) => assets[`../assets/infinite/${file}`];
export const infiniteAlbums: { color: Gem; title: string; year: number; era: string; cover: string }[] = [
  { color: 'white', title: '우리의 계절', year: 2026, era: 'i-still-remember', cover: asset('i-still-remember-cover.jpg') },
  { color: 'blue', title: 'LIKE INFINITE', year: 2025, era: 'like-infinite', cover: asset('like-infinite-cover.jpg') },
  { color: 'green', title: 'INFINITE ONLY', year: 2016, era: 'infinite-only', cover: asset('infinite-only-cover.jpg') },
  { color: 'red', title: 'Destiny', year: 2013, era: 'destiny', cover: asset('destiny-cover.jpg') },
  { color: 'black', title: 'Reality', year: 2015, era: 'reality', cover: asset('reality-cover.jpg') },
  { color: 'gold', title: 'Over the Top', year: 2011, era: 'over-the-top', cover: asset('over-the-top-cover.jpg') },
];
const photos = (era: string) => manifest.filter(entry => entry.era === era && entry.member !== 'cover');
export const infiniteAppearance: PreviewAppearance = {
  names: Object.fromEntries(infiniteAlbums.map(album => [album.color, album.title])) as Record<Gem, string>,
  icons: Object.fromEntries(infiniteAlbums.map(album => [album.color, album.cover])) as Record<Gem, string>,
  card(card) {
    const album = infiniteAlbums.find(album => album.color === card.bonusColor)!;
    const portraits = photos(album.era);
    const index = (Number(card.id.slice(-2)) - 1 + (card.level - 1) * 2) % portraits.length;
    const portrait = portraits[index];
    return { src: asset(portrait.file), label: `${portrait.member} · ${album.title}` };
  },
  nobles: photos('like-infinite').map(photo => ({ src: asset(photo.file), label: photo.member })),
};
export const infiniteSources = [
  { label: '앨범 표지 · Apple Music / INFINITE', url: 'https://music.apple.com/us/artist/infinite/407674485' },
      { label: 'INFINITE ONLY · Woollim 공개 콘셉트 사진 / Soompi', url: 'https://www.soompi.com/article/891769wpp/watch-infinite-shares-dramatic-teaser-video-comeback-announces-release-date' },
  { label: 'Destiny · Woollim 공개 개인 사진 / Soompi', url: 'https://www.soompi.com/article/509531wpp/infinite-shows-manly-charisma-in-individual-destiny-concept-photos' },
  { label: 'Reality · 성규·엘·성종 공개 사진 / Soompi', url: 'https://www.soompi.com/article/747757wpp/infinite-confirms-comeback-date-for-reality-intro-to-first-track' },
  { label: 'LIKE INFINITE · INFINITE COMPANY 공개 개인 사진 / Soompi', url: 'https://www.soompi.com/article/1721496wpp/infinite-reveals-march-comeback-date-and-1st-teaser-for-like-infinite' },
  { label: '우리의 계절 · INFINITE COMPANY 공개 활동 사진 / 한국트렌드연구소', url: 'https://koreantrend-research.jp/210619/' },
];

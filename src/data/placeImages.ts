import iskconImg from '../assets/images/bengaluru_iskcon_temple_1794720202406.jpg';
import lalbaghImg from '../assets/images/bengaluru_lalbagh_park_1794720203582.jpg';
import cubbonImg from '../assets/images/bengaluru_cubbon_park_1794720203317.jpg';
import orionImg from '../assets/images/bengaluru_orion_mall_1794720203785.jpg';
import palaceImg from '../assets/images/bengaluru_bangalore_palace_1794720204120.jpg';
import vidhanaImg from '../assets/images/bengaluru_vidhana_soudha_1794720204477.jpg';
import metroImg from '../assets/images/bengaluru_metro_transit_1794720204496.jpg';
import marketImg from '../assets/images/bengaluru_kr_market_1794720205620.jpg';
import diningImg from '../assets/images/bengaluru_ub_city_dining_1794720205350.jpg';

const IMAGE_MAP: Record<string, string> = {
  iskcon: iskconImg,
  lalbagh: lalbaghImg,
  cubbon: cubbonImg,
  orion: orionImg,
  palace: palaceImg,
  vidhana: vidhanaImg,
  metro: metroImg,
  market: marketImg,
  dining: diningImg,
};

export function getPlaceImageSrc(imageKey: string, imageUrl?: string): string {
  if (imageUrl && imageUrl.trim().length > 0) {
    return imageUrl;
  }
  return IMAGE_MAP[imageKey] ?? vidhanaImg;
}

import React, {useEffect, useRef} from 'react';
import * as maplibregl from 'maplibre-gl';
import {Compass, LocateFixed, Minus, Plus} from 'lucide-react';
import type {PlaceCategory, PlaceSummary} from '../../types/krowd';
import type {UserCoordinates} from '../../hooks/useGeolocation';
import {CROWD_COLORS} from '../../utils/crowdStyles';

interface BengaluruMapProps {
  places: PlaceSummary[];
  selectedPlaceId: string | null;
  onSelectPlace: (placeId: string) => void;
  userCoords: UserCoordinates | null;
  onRequestLocation: () => void;
  flyToCoords?: {lat: number; lon: number; zoom?: number} | null;
  onViewportChange?: (bounds: {
    south: number;
    west: number;
    north: number;
    east: number;
    zoom: number;
  }) => void;
  className?: string;
}

const DEFAULT_CENTER: [number, number] = [76.1, 15.0];
const getDefaultZoom = () =>
  typeof window !== 'undefined' && window.innerWidth < 768 ? 5.7 : 6.4;
const OPENFREEMAP_STYLE_URL = 'https://tiles.openfreemap.org/styles/positron';
const CARTO_FALLBACK_STYLE_URL = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';

function setLayerPaintSafe(
  map: maplibregl.Map,
  layerId: string,
  property: Parameters<maplibregl.Map['setPaintProperty']>[1],
  value: string
) {
  if (!map.getLayer(layerId)) return;
  try {
    map.setPaintProperty(layerId, property, value);
  } catch {
    // Ignore incompatible paint property on alternate style layers
  }
}

function applyNeoMintMapTheme(map: maplibregl.Map) {
  // Soft warm land & subtle urban tint
  setLayerPaintSafe(map, 'background', 'background-color', '#F4F7F0');
  setLayerPaintSafe(map, 'landcover', 'fill-color', '#EEF4E7');
  setLayerPaintSafe(map, 'landuse_residential', 'fill-color', '#EDF3E6');
  setLayerPaintSafe(map, 'landuse', 'fill-color', '#EDF3E6');
  setLayerPaintSafe(map, 'building', 'fill-color', '#E6EDE0');
  setLayerPaintSafe(map, 'building', 'fill-outline-color', '#D7E2CE');
  setLayerPaintSafe(map, 'building-top', 'fill-color', '#E6EDE0');

  // Clean soft pastel blue/teal water bodies
  setLayerPaintSafe(map, 'water', 'fill-color', '#C5D9E8');
  setLayerPaintSafe(map, 'water_shadow', 'fill-color', '#B6CEE0');
  setLayerPaintSafe(map, 'waterway', 'line-color', '#C5D9E8');

  // Soft pastel mint/sage parks & green spaces
  setLayerPaintSafe(map, 'park', 'fill-color', '#D4E8C5');
  setLayerPaintSafe(map, 'park_national_park', 'fill-color', '#D4E8C5');
  setLayerPaintSafe(map, 'park_nature_reserve', 'fill-color', '#D4E8C5');
  setLayerPaintSafe(map, 'landcover_wood', 'fill-color', '#CDE5BE');

  // Crisp clean white roads & highways with subtle soft neo-mint borders
  for (const roadFillId of [
    'highway_minor',
    'highway_major_inner',
    'highway_motorway_inner',
    'highway_motorway_bridge_inner',
    'tunnel_motorway_inner',
    'road_minor_fill',
    'road_sec_fill_noramp',
    'road_pri_fill_noramp',
    'road_pri_fill_ramp',
    'road_trunk_fill_noramp',
    'road_trunk_fill_ramp',
    'road_mot_fill_noramp',
    'road_mot_fill_ramp',
    'bridge_minor_fill',
    'bridge_sec_fill',
    'bridge_pri_fill',
    'bridge_trunk_fill',
    'bridge_mot_fill',
  ]) {
    setLayerPaintSafe(map, roadFillId, 'line-color', '#FFFFFF');
  }

  for (const roadCasingId of [
    'highway_major_casing',
    'highway_motorway_casing',
    'highway_motorway_bridge_casing',
    'tunnel_motorway_casing',
    'highway_major_subtle',
    'highway_motorway_subtle',
    'highway_path',
    'road_service_case',
    'road_minor_case',
    'road_sec_case_noramp',
    'road_pri_case_noramp',
    'road_pri_case_ramp',
    'road_trunk_case_noramp',
    'road_trunk_case_ramp',
    'road_mot_case_noramp',
    'road_mot_case_ramp',
    'bridge_minor_case',
    'bridge_sec_case',
    'bridge_pri_case',
    'bridge_trunk_case',
    'bridge_mot_case',
  ]) {
    setLayerPaintSafe(map, roadCasingId, 'line-color', '#D7E2CE');
  }

  // Harmonized obsidian & sage typography
  for (const labelId of [
    'label_city',
    'label_city_capital',
    'label_town',
    'label_village',
    'label_other',
    'label_state',
    'label_country_1',
    'label_country_2',
    'label_country_3',
    'place_country_1',
    'place_country_2',
    'place_state',
    'place_city_r5',
    'place_city_r6',
    'place_town',
    'place_suburbs',
    'place_villages',
  ]) {
    setLayerPaintSafe(map, labelId, 'text-color', '#1A211C');
    setLayerPaintSafe(map, labelId, 'text-halo-color', 'rgba(244, 247, 240, 0.92)');
  }

  for (const roadLabelId of [
    'highway-name-major',
    'highway-name-minor',
    'highway-name-path',
    'roadname_major',
    'roadname_pri',
    'roadname_sec',
    'roadname_minor',
  ]) {
    setLayerPaintSafe(map, roadLabelId, 'text-color', '#4B5A4F');
    setLayerPaintSafe(map, roadLabelId, 'text-halo-color', 'rgba(255, 255, 255, 0.92)');
  }

  for (const waterLabelId of [
    'water_name_point_label',
    'water_name_line_label',
    'waterway_line_label',
    'watername_lake',
    'watername_lake_line',
  ]) {
    setLayerPaintSafe(map, waterLabelId, 'text-color', '#496E88');
  }
}

if (typeof window !== 'undefined') {
  maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs');
}

function getCategorySvgPath(category: PlaceCategory): string {
  switch (category) {
    case 'Temples':
      return '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>';
    case 'Malls':
      return '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>';
    case 'Parks':
      return '<path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z"/><path d="M7 16v6"/><path d="M13 19v3"/><path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5"/>';
    case 'Tourist Places':
      return '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>';
    case 'Restaurants':
      return '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>';
    case 'Transport':
      return '<rect width="16" height="16" x="4" y="3" rx="2"/><path d="M4 11h16"/><path d="M12 3v8"/><path d="m8 19-2 3"/><path d="m18 22-2-3"/><path d="M8 15h.01"/><path d="M16 15h.01"/>';
    case 'Markets':
      return '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/>';
    case 'Events':
      return '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>';
  }
}

interface MarkerRecord {
  place: PlaceSummary;
  marker: maplibregl.Marker;
  wrapper: HTMLButtonElement;
  pin: HTMLDivElement;
  label: HTMLSpanElement;
  crowdColor: string;
  isSelected: boolean;
}

export const BengaluruMap: React.FC<BengaluruMapProps> = React.memo(({
  places,
  selectedPlaceId,
  onSelectPlace,
  userCoords,
  onRequestLocation,
  flyToCoords,
  onViewportChange,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, MarkerRecord>>(new Map());
  const markerMetaRef = useRef<MarkerRecord[]>([]);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const onSelectRef = useRef(onSelectPlace);
  onSelectRef.current = onSelectPlace;
  const onViewportChangeRef = useRef(onViewportChange);
  onViewportChangeRef.current = onViewportChange;
  const selectedPlaceIdRef = useRef(selectedPlaceId);
  selectedPlaceIdRef.current = selectedPlaceId;
  const lastFlownPlaceIdRef = useRef<string | null>(null);

  const updateMarkerLayoutRef = useRef<() => void>(() => {});
  updateMarkerLayoutRef.current = () => {
    const map = mapRef.current;
    if (!map) return;

    const zoom = map.getZoom();
    const metas = markerMetaRef.current;
    if (!metas.length) return;

    const sorted = [...metas].sort((a, b) => {
      if (a.place.id === selectedPlaceIdRef.current) return -1;
      if (b.place.id === selectedPlaceIdRef.current) return 1;
      return b.place.popularityScore - a.place.popularityScore;
    });

    const enforcePinSpacing = zoom < 12.0 && sorted.length > 10;
    const minPinDist = zoom < 8.5 ? 36 : zoom < 10.5 ? 40 : 34;

    const placedPins: Array<{x: number; y: number}> = [];
    const placedBoxes: Array<{left: number; right: number; top: number; bottom: number}> = [];

    for (const item of sorted) {
      const isSelected = item.place.id === selectedPlaceIdRef.current;
      const pt = map.project([item.place.longitude, item.place.latitude]);

      let showPin = true;
      if (enforcePinSpacing && !isSelected) {
        for (const p of placedPins) {
          const dx = pt.x - p.x;
          const dy = pt.y - p.y;
          if (dx * dx + dy * dy < minPinDist * minPinDist) {
            showPin = false;
            break;
          }
        }
      }

      if (!showPin) {
        item.wrapper.style.display = 'none';
        continue;
      }

      item.wrapper.style.display = 'flex';
      placedPins.push({x: pt.x, y: pt.y});

      const pinHalf = isSelected ? 24 : 20;
      const pinBox = {
        left: pt.x - pinHalf,
        right: pt.x + pinHalf,
        top: pt.y - pinHalf,
        bottom: pt.y + pinHalf,
      };

      const approxLabelWidth = Math.min(148, Math.max(58, item.place.name.length * 6.8 + 18));
      const labelBox = {
        left: pt.x - approxLabelWidth / 2,
        right: pt.x + approxLabelWidth / 2,
        top: pt.y + pinHalf + 2,
        bottom: pt.y + pinHalf + 24,
      };

      let showLabel = isSelected || zoom >= 13.2;
      if (!showLabel) {
        const collides = placedBoxes.some(
          (b) =>
            !(
              labelBox.right < b.left ||
              labelBox.left > b.right ||
              labelBox.bottom < b.top ||
              labelBox.top > b.bottom
            )
        );
        showLabel = !collides;
      }

      placedBoxes.push(pinBox);
      if (showLabel) {
        item.label.style.display = 'block';
        placedBoxes.push(labelBox);
      } else {
        item.label.style.display = 'none';
      }
    }
  };

  // Initialize MapLibre GL JS once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let switchedToFallback = false;
    let rafId: number | null = null;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OPENFREEMAP_STYLE_URL,
      center: DEFAULT_CENTER,
      zoom: getDefaultZoom(),
      minZoom: 2.5,
      maxZoom: 17.5,
      attributionControl: false,
    });

    const scheduleLayout = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        updateMarkerLayoutRef.current();
      });
    };

    const emitViewport = () => {
      if (!onViewportChangeRef.current) return;
      const b = map.getBounds();
      onViewportChangeRef.current({
        south: b.getSouth(),
        west: b.getWest(),
        north: b.getNorth(),
        east: b.getEast(),
        zoom: map.getZoom(),
      });
    };

    map.on('style.load', () => {
      applyNeoMintMapTheme(map);
    });

    map.on('load', emitViewport);
    map.on('move', scheduleLayout);
    map.on('moveend', () => {
      scheduleLayout();
      emitViewport();
    });
    map.on('zoomend', scheduleLayout);

    map.on('error', (event) => {
      if (switchedToFallback) return;
      const sourceId = (event as {sourceId?: string}).sourceId;
      if (!map.isStyleLoaded() || !sourceId || sourceId === 'openmaptiles') {
        switchedToFallback = true;
        map.setStyle(CARTO_FALLBACK_STYLE_URL);
      }
    });

    map.addControl(
      new maplibregl.AttributionControl({compact: true}),
      'bottom-left'
    );

    mapRef.current = map;

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      markersRef.current.forEach((rec) => rec.marker.remove());
      markersRef.current.clear();
      markerMetaRef.current = [];
      userMarkerRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Sync place markers incrementally without destroying unchanged DOM nodes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const nextIds = new Set(places.map((p) => p.id));
    markersRef.current.forEach((rec, id) => {
      if (!nextIds.has(id)) {
        rec.marker.remove();
        markersRef.current.delete(id);
      }
    });

    const nextMeta: MarkerRecord[] = [];

    places.forEach((place) => {
      const existing = markersRef.current.get(place.id);
      const isSelected = place.id === selectedPlaceId;
      const crowdColor = CROWD_COLORS[place.crowd.crowdLevel].hex;

      if (existing) {
        existing.place = place;
        if (existing.crowdColor !== crowdColor || existing.isSelected !== isSelected) {
          existing.crowdColor = crowdColor;
          existing.isSelected = isSelected;
          existing.wrapper.style.zIndex = isSelected ? '30' : '10';
          existing.wrapper.setAttribute(
            'aria-label',
            `${place.name}, ${place.category}, ${place.crowd.crowdLevel} crowd`
          );

          existing.pin.style.width = isSelected ? '44px' : '36px';
          existing.pin.style.height = isSelected ? '44px' : '36px';
          existing.pin.style.background = isSelected ? '#121814' : '#FFFFFF';
          existing.pin.style.color = isSelected ? '#A3E635' : '#1A211C';
          existing.pin.style.border = `3px solid ${crowdColor}`;
          existing.pin.style.boxShadow = `0 8px 20px rgba(40, 60, 30, ${
            isSelected ? '0.28' : '0.16'
          })`;
          const svg = existing.pin.firstElementChild as SVGElement | null;
          if (svg) {
            const size = isSelected ? '19' : '16';
            svg.setAttribute('width', size);
            svg.setAttribute('height', size);
          }

          existing.label.style.background = isSelected
            ? '#121814'
            : 'rgba(255, 255, 255, 0.96)';
          existing.label.style.color = isSelected ? '#FFFFFF' : '#1A211C';
          existing.label.style.border = `1px solid ${isSelected ? '#121814' : '#D1E7BD'}`;
          existing.label.style.opacity = isSelected ? '1' : '0.94';
        }
        nextMeta.push(existing);
        return;
      }

      const wrapper = document.createElement('button');
      wrapper.type = 'button';
      wrapper.setAttribute(
        'aria-label',
        `${place.name}, ${place.category}, ${place.crowd.crowdLevel} crowd`
      );
      wrapper.className = 'group relative flex flex-col items-center focus:outline-none cursor-pointer';
      wrapper.style.zIndex = isSelected ? '30' : '10';
      wrapper.style.willChange = 'transform';

      const pin = document.createElement('div');
      pin.style.cssText = `
        width: ${isSelected ? '44px' : '36px'};
        height: ${isSelected ? '44px' : '36px'};
        border-radius: 9999px;
        background: ${isSelected ? '#121814' : '#FFFFFF'};
        color: ${isSelected ? '#A3E635' : '#1A211C'};
        border: 3px solid ${crowdColor};
        box-shadow: 0 8px 20px rgba(40, 60, 30, ${isSelected ? '0.28' : '0.16'});
        display: flex;
        align-items: center;
        justify-content: center;
        will-change: transform;
        transition: transform 180ms cubic-bezier(0.16, 1, 0.3, 1), box-shadow 180ms ease;
      `;
      pin.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${
        isSelected ? 19 : 16
      }" height="${
        isSelected ? 19 : 16
      }" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${getCategorySvgPath(
        place.category
      )}</svg>`;

      const label = document.createElement('span');
      label.textContent = place.name;
      label.style.cssText = `
        margin-top: 4px;
        padding: 2px 8px;
        border-radius: 8px;
        background: ${isSelected ? '#121814' : 'rgba(255, 255, 255, 0.96)'};
        color: ${isSelected ? '#FFFFFF' : '#1A211C'};
        border: 1px solid ${isSelected ? '#121814' : '#D1E7BD'};
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
        font-size: 11px;
        font-weight: 600;
        line-height: 1.2;
        letter-spacing: -0.005em;
        white-space: nowrap;
        box-shadow: 0 4px 12px rgba(40, 60, 30, 0.12);
        max-width: 148px;
        overflow: hidden;
        text-overflow: ellipsis;
        opacity: ${isSelected ? '1' : '0.94'};
      `;

      wrapper.appendChild(pin);
      wrapper.appendChild(label);

      wrapper.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectRef.current(place.id);
      });

      const marker = new maplibregl.Marker({element: wrapper, anchor: 'center'})
        .setLngLat([place.longitude, place.latitude])
        .addTo(map);

      const rec: MarkerRecord = {
        place,
        marker,
        wrapper,
        pin,
        label,
        crowdColor,
        isSelected,
      };
      markersRef.current.set(place.id, rec);
      nextMeta.push(rec);
    });

    markerMetaRef.current = nextMeta;
    updateMarkerLayoutRef.current();
  }, [places, selectedPlaceId]);

  // Center on newly selected place smoothly without re-flying on live background refreshes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedPlaceId) {
      lastFlownPlaceIdRef.current = null;
      return;
    }
    if (lastFlownPlaceIdRef.current === selectedPlaceId) return;
    const selected = places.find((p) => p.id === selectedPlaceId);
    if (!selected) return;

    lastFlownPlaceIdRef.current = selectedPlaceId;
    map.flyTo({
      center: [selected.longitude, selected.latitude],
      zoom: Math.max(map.getZoom(), 13.6),
      duration: 600,
      essential: true,
    });
  }, [selectedPlaceId, places]);

  // External fly-to (e.g. search or user location)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !flyToCoords) return;
    map.flyTo({
      center: [flyToCoords.lon, flyToCoords.lat],
      zoom: flyToCoords.zoom ?? 13.2,
      duration: 650,
      essential: true,
    });
  }, [flyToCoords]);

  // Render current user coordinates indicator
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    userMarkerRef.current?.remove();
    if (!userCoords) return;

    const el = document.createElement('div');
    el.setAttribute('aria-label', 'Your current location');
    el.style.cssText = `
      width: 24px;
      height: 24px;
      border-radius: 9999px;
      background: rgba(163, 230, 53, 0.35);
      display: flex;
      align-items: center;
      justify-content: center;
    `;
    const dot = document.createElement('div');
    dot.style.cssText = `
      width: 12px;
      height: 12px;
      border-radius: 9999px;
      background: #121814;
      border: 2.5px solid #A3E635;
      box-shadow: 0 2px 8px rgba(40, 60, 30, 0.28);
    `;
    el.appendChild(dot);

    userMarkerRef.current = new maplibregl.Marker({element: el, anchor: 'center'})
      .setLngLat([userCoords.longitude, userCoords.latitude])
      .addTo(map);
  }, [userCoords]);

  const handleZoomIn = () => mapRef.current?.zoomIn({duration: 240});
  const handleZoomOut = () => mapRef.current?.zoomOut({duration: 240});
  const handleResetOverview = () => {
    mapRef.current?.flyTo({
      center: DEFAULT_CENTER,
      zoom: getDefaultZoom(),
      bearing: 0,
      pitch: 0,
      duration: 600,
    });
  };
  const handleCenterOnUser = () => {
    if (userCoords) {
      mapRef.current?.flyTo({
        center: [userCoords.longitude, userCoords.latitude],
        zoom: 13.4,
        duration: 600,
      });
    } else {
      onRequestLocation();
    }
  };

  return (
    <div className={`relative w-full h-full bg-[#E6F4D7] ${className}`}>
      <div ref={containerRef} className="w-full h-full" />

      {/* Map Controls */}
      <div className="absolute right-4 top-28 md:top-24 z-10 flex flex-col gap-2">
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={handleZoomIn}
            aria-label="Zoom in map"
            className="w-11 h-11 rounded-2xl bg-[#FFFFFF]/95 backdrop-blur-md border border-[#D1E7BD] shadow-[0_10px_30px_rgba(40,60,30,0.08)] flex items-center justify-center text-[#1A211C] hover:bg-[#E6F4D7] transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            aria-label="Zoom out map"
            className="w-11 h-11 rounded-2xl bg-[#FFFFFF]/95 backdrop-blur-md border border-[#D1E7BD] shadow-[0_10px_30px_rgba(40,60,30,0.08)] flex items-center justify-center text-[#1A211C] hover:bg-[#E6F4D7] transition-colors"
          >
            <Minus className="w-4 h-4" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleCenterOnUser}
          aria-label="Center on current location"
          title={userCoords ? 'Center on your location' : 'Detect your location'}
          className="w-11 h-11 rounded-2xl bg-white/95 backdrop-blur-md border border-[#D1E7BD] shadow-[0_10px_30px_rgba(40,60,30,0.08)] flex items-center justify-center text-[#1A211C] hover:bg-[#E6F4D7] transition-colors"
        >
          <LocateFixed
            className={`w-4 h-4 ${userCoords ? 'text-[#84CC16]' : 'text-[#1A211C]'}`}
          />
        </button>

        <button
          type="button"
          onClick={handleResetOverview}
          aria-label="Reset map to Karnataka overview"
          title="Karnataka overview"
          className="w-11 h-11 rounded-2xl bg-white/95 backdrop-blur-md border border-[#D1E7BD] shadow-[0_10px_30px_rgba(40,60,30,0.08)] flex items-center justify-center text-[#1A211C] hover:bg-[#E6F4D7] transition-colors"
        >
          <Compass className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
});

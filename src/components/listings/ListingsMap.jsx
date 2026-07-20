import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Rectangle, useMapEvents, useMap } from 'react-leaflet';
import { Link } from 'react-router-dom';
import { ShieldCheck, Bed, Bath, Star, X, MapPin, SlidersHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NEIGHBORHOOD_LABELS } from '@/lib/constants';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const PV_CENTER = [20.6534, -105.2253];

function createPriceIcon(price, isVerified, isFeatured, isActive) {
  const bg = isFeatured ? '#f59e0b' : isVerified ? '#0ea5e9' : '#1e293b';
  const label = price ? `$${(price / 1000).toFixed(price % 1000 === 0 ? 0 : 1)}k` : '?';
  const scale = isActive ? 'transform:scale(1.2);z-index:1000;' : '';
  return L.divIcon({
    className: '',
    html: `<div style="
      background:${bg};
      color:white;
      font-weight:700;
      font-size:12px;
      padding:4px 9px;
      border-radius:20px;
      white-space:nowrap;
      box-shadow:0 2px 10px rgba(0,0,0,0.3);
      border:${isActive ? '2.5px solid #fff' : '2px solid white'};
      cursor:pointer;
      transition:transform 0.15s;
      ${scale}
    ">${label}/mo</div>`,
    iconAnchor: [28, 16],
    popupAnchor: [0, -20],
  });
}

function FitBounds({ listings }) {
  const map = useMap();
  React.useEffect(() => {
    const wc = listings.filter(l => l.latitude && l.longitude);
    if (!wc.length) return;
    if (wc.length === 1) { map.setView([wc[0].latitude, wc[0].longitude], 14); return; }
    map.fitBounds(L.latLngBounds(wc.map(l => [l.latitude, l.longitude])), { padding: [40, 40] });
  }, [listings, map]);
  return null;
}

// Track visible listings based on current map bounds
function BoundsWatcher({ onBoundsChange }) {
  useMapEvents({
    moveend: (e) => onBoundsChange(e.target.getBounds()),
    zoomend: (e) => onBoundsChange(e.target.getBounds()),
    load: (e) => onBoundsChange(e.target.getBounds()),
  });
  return null;
}

// Draw-to-filter rectangle selection
function DrawFilter({ isDrawing, onDrawComplete }) {
  const [start, setStart] = useState(null);
  const [current, setCurrent] = useState(null);

  useMapEvents({
    mousedown: (e) => {
      if (!isDrawing) return;
      e.originalEvent.preventDefault();
      setStart(e.latlng);
      setCurrent(e.latlng);
    },
    mousemove: (e) => {
      if (!isDrawing || !start) return;
      setCurrent(e.latlng);
    },
    mouseup: (e) => {
      if (!isDrawing || !start) return;
      onDrawComplete(L.latLngBounds(start, e.latlng));
      setStart(null);
      setCurrent(null);
    },
  });

  if (!start || !current) return null;
  return (
    <Rectangle
      bounds={L.latLngBounds(start, current)}
      pathOptions={{ color: '#0ea5e9', weight: 2, fillOpacity: 0.1, dashArray: '6,4' }}
    />
  );
}

function ListingPopupCard({ listing }) {
  return (
    <Link to={`/listings/${listing.id}`} className="block no-underline group w-[220px]">
      {listing.photos?.[0] && (
        <div className="relative -mx-3 -mt-3 mb-3 overflow-hidden rounded-t-lg h-32">
          <img src={listing.photos[0]} alt={listing.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          <div className="absolute top-2 left-2 flex gap-1">
            {listing.is_verified && <span className="bg-sky-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"><ShieldCheck size={10} /> Verified</span>}
            {listing.is_featured && <span className="bg-amber-400 text-amber-900 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"><Star size={10} /> Featured</span>}
          </div>
        </div>
      )}
      <p className="font-bold text-sm text-gray-900 leading-snug line-clamp-2 group-hover:text-sky-600 transition-colors">{listing.title}</p>
      <p className="text-xs text-gray-500 mt-0.5">{NEIGHBORHOOD_LABELS[listing.neighborhood] || listing.neighborhood}</p>
      <div className="flex items-center justify-between mt-2">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="flex items-center gap-0.5"><Bed size={12} /> {listing.bedrooms} bd</span>
          <span className="flex items-center gap-0.5"><Bath size={12} /> {listing.bathrooms} ba</span>
          {listing.pet_friendly && <span>🐾</span>}
        </div>
        <span className="font-bold text-sm text-gray-900">${listing.price_usd?.toLocaleString()}<span className="text-gray-400 font-normal">/mo</span></span>
      </div>
      <div className="mt-2 text-center text-xs font-semibold text-sky-600">View Details →</div>
    </Link>
  );
}

function SidePanel({ listings, activeId, onHover, onClose }) {
  return (
    <div className="absolute top-0 right-0 h-full w-72 z-[1000] bg-white/95 backdrop-blur-sm border-l shadow-xl flex flex-col rounded-r-2xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b shrink-0">
        <span className="font-semibold text-sm">{listings.length} listing{listings.length !== 1 ? 's' : ''} in view</span>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
      </div>
      <div className="overflow-y-auto flex-1 p-2 space-y-2">
        {listings.length === 0 && (
          <p className="text-center text-sm text-muted-foreground py-8">No listings in this area.<br/>Pan or zoom to explore.</p>
        )}
        {listings.map(l => (
          <Link
            key={l.id}
            to={`/listings/${l.id}`}
            onMouseEnter={() => onHover(l.id)}
            onMouseLeave={() => onHover(null)}
            className={`flex gap-2.5 p-2 rounded-xl border transition-all no-underline group ${activeId === l.id ? 'border-primary bg-primary/5 shadow-sm' : 'border-transparent hover:border-border hover:bg-muted/50'}`}
          >
            <img
              src={l.photos?.[0] || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=200&q=60'}
              alt={l.title}
              className="w-16 h-14 object-cover rounded-lg shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-900 line-clamp-2 leading-snug group-hover:text-primary transition-colors">{l.title}</p>
              <p className="text-[11px] text-gray-500 mt-0.5 truncate">{NEIGHBORHOOD_LABELS[l.neighborhood]}</p>
              <p className="text-xs font-bold text-gray-900 mt-1">${l.price_usd?.toLocaleString()}<span className="font-normal text-gray-400">/mo</span></p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

const NEIGHBORHOOD_COORDS = {
  romantica: [20.6025, -105.2372],
  marina_vallarta: [20.6653, -105.2536],
  nuevo_vallarta: [20.6922, -105.2891],
  centro: [20.6120, -105.2335],
  amapas: [20.5960, -105.2355],
  conchas_chinas: [20.5878, -105.2311],
  fluvial: [20.6405, -105.2285],
  versalles: [20.6355, -105.2315],
  pitillal: [20.6489, -105.2132],
  las_juntas: [20.6865, -105.2325],
  hotel_zone: [20.6300, -105.2410],
  south_side: [20.6010, -105.2375],
  bucerias: [20.7554, -105.3323],
  la_cruz: [20.7297, -105.3789],
  punta_mita: [20.7681, -105.5264],
  sayulita: [20.8689, -105.4408],
  cinco_de_diciembre: [20.6225, -105.2320],
  alta_vista: [20.6045, -105.2310],
  lazaro_cardenas: [20.6200, -105.2280],
};

export default function ListingsMap({ listings }) {
  const [activeId, setActiveId] = useState(null);
  const [mapBounds, setMapBounds] = useState(null);
  const [drawnBounds, setDrawnBounds] = useState(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [showPanel, setShowPanel] = useState(true);
  const mapRef = useRef(null);

  const withCoords = useMemo(() => {
    // Generate a deterministic offset or random offset based on listing id or seed to avoid re-shifting on every render
    return listings.map(l => {
      if (l.latitude && l.longitude) {
        return { ...l, latitude: Number(l.latitude), longitude: Number(l.longitude) };
      }
      
      const defaultCoords = NEIGHBORHOOD_COORDS[l.neighborhood];
      // Create a deterministic offset from listing id to prevent continuous shifts on map re-renders
      let hash = 0;
      if (l.id) {
        for (let i = 0; i < l.id.length; i++) {
          hash = l.id.charCodeAt(i) + ((hash << 5) - hash);
        }
      }
      const latOffset = ((hash & 0xFF) / 255 - 0.5) * 0.004;
      const lngOffset = (((hash >> 8) & 0xFF) / 255 - 0.5) * 0.004;

      if (defaultCoords) {
        return {
          ...l,
          latitude: defaultCoords[0] + latOffset,
          longitude: defaultCoords[1] + lngOffset,
        };
      }
      // PV Center fallback
      return {
        ...l,
        latitude: 20.6534 + latOffset,
        longitude: -105.2253 + lngOffset,
      };
    });
  }, [listings]);

  // Filter by drawn bounds or map bounds
  const visibleListings = withCoords.filter(l => {
    const bounds = drawnBounds || mapBounds;
    if (!bounds) return true;
    return bounds.contains([l.latitude, l.longitude]);
  });

  const handleDrawComplete = useCallback((bounds) => {
    setDrawnBounds(bounds);
    setIsDrawing(false);
  }, []);

  const clearDraw = () => { setDrawnBounds(null); };

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border shadow-sm" style={{ height: 620 }}>
      {withCoords.length === 0 && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-muted/80 rounded-2xl">
          <span className="text-4xl mb-3">🗺️</span>
          <p className="font-semibold text-lg">No map data available</p>
          <p className="text-sm text-muted-foreground mt-1">Listings need coordinates to appear on the map</p>
        </div>
      )}

      {/* Toolbar */}
      <div className="absolute top-3 left-3 z-[1000] flex gap-2">
        <button
          onClick={() => { setIsDrawing(d => !d); setDrawnBounds(null); }}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shadow border transition-colors ${isDrawing ? 'bg-primary text-primary-foreground border-primary' : 'bg-white/90 hover:bg-white text-gray-700 border-white'}`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          {isDrawing ? 'Drawing… (drag map)' : 'Filter by Area'}
        </button>
        {drawnBounds && (
          <button
            onClick={clearDraw}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/90 hover:bg-white text-gray-700 border border-white shadow"
          >
            <X className="w-3.5 h-3.5" /> Clear Filter ({visibleListings.length})
          </button>
        )}
      </div>

      {/* Panel toggle when hidden */}
      {!showPanel && (
        <button
          onClick={() => setShowPanel(true)}
          className="absolute top-3 right-3 z-[1000] flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/90 hover:bg-white text-gray-700 border border-white shadow"
        >
          <MapPin className="w-3.5 h-3.5" /> Show List ({visibleListings.length})
        </button>
      )}

      <MapContainer
        center={PV_CENTER}
        zoom={13}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
        ref={mapRef}
        className={isDrawing ? 'cursor-crosshair' : ''}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds listings={withCoords} />
        <BoundsWatcher onBoundsChange={setMapBounds} />
        <DrawFilter isDrawing={isDrawing} onDrawComplete={handleDrawComplete} />

        {drawnBounds && (
          <Rectangle
            bounds={drawnBounds}
            pathOptions={{ color: '#0ea5e9', weight: 2, fillOpacity: 0.07, dashArray: '6,4' }}
          />
        )}

        {withCoords.map(listing => {
          const inView = visibleListings.includes(listing);
          return (
            <Marker
              key={listing.id}
              position={[listing.latitude, listing.longitude]}
              icon={createPriceIcon(listing.price_usd, listing.is_verified, listing.is_featured, activeId === listing.id)}
              opacity={drawnBounds && !inView ? 0.3 : 1}
              eventHandlers={{
                click: () => setActiveId(listing.id),
                mouseover: () => setActiveId(listing.id),
                mouseout: () => setActiveId(null),
              }}
            >
              <Popup maxWidth={240} minWidth={220}>
                <ListingPopupCard listing={listing} />
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

      {/* Side panel */}
      {showPanel && (
        <SidePanel
          listings={visibleListings}
          activeId={activeId}
          onHover={setActiveId}
          onClose={() => setShowPanel(false)}
        />
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-white/90 backdrop-blur-sm rounded-xl shadow px-3 py-2 text-xs space-y-1 border">
        <div className="flex items-center gap-2"><span className="inline-block w-4 h-3 rounded-full bg-sky-500" /> Verified</div>
        <div className="flex items-center gap-2"><span className="inline-block w-4 h-3 rounded-full bg-amber-400" /> Featured</div>
        <div className="flex items-center gap-2"><span className="inline-block w-4 h-3 rounded-full bg-slate-800" /> Standard</div>
      </div>
    </div>
  );
}
import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { Link } from 'react-router-dom';
import { ShieldCheck, Bed, Bath, Star, X, MapPin, SlidersHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NEIGHBORHOOD_LABELS } from '@/lib/constants';

const PV_CENTER = { lat: 20.6534, lng: -105.2253 };

function ListingPopupCard({ listing }) {
  return (
    <Link to={`/listings/${listing.id}`} className="block no-underline group w-[220px] text-gray-900">
      {listing.photos?.[0] && (
        <div className="relative mb-3 overflow-hidden rounded-t-lg h-32">
          <img src={listing.photos[0]} alt={listing.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          <div className="absolute top-2 left-2 flex gap-1 z-10">
            {listing.is_verified && <span className="bg-sky-500 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"><ShieldCheck size={10} /> Verified</span>}
            {listing.is_featured && <span className="bg-amber-400 text-amber-900 text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1"><Star size={10} /> Featured</span>}
          </div>
        </div>
      )}
      <p className="font-bold text-sm leading-snug line-clamp-2 group-hover:text-sky-600 transition-colors">{listing.title}</p>
      <p className="text-xs text-gray-500 mt-0.5">{NEIGHBORHOOD_LABELS[listing.neighborhood] || listing.neighborhood}</p>
      <div className="flex items-center justify-between mt-2 text-gray-800">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <span className="flex items-center gap-0.5"><Bed size={12} /> {listing.bedrooms} bd</span>
          <span className="flex items-center gap-0.5"><Bath size={12} /> {listing.bathrooms} ba</span>
          {listing.pet_friendly && <span>🐾</span>}
        </div>
        <span className="font-bold text-sm">
          {listing.price_mxn ? `${Number(listing.price_mxn).toLocaleString()} MXN` : `$${listing.price_usd?.toLocaleString()}`}
          <span className="text-gray-400 font-normal">/mo</span>
        </span>
      </div>
      <div className="mt-2 text-center text-xs font-semibold text-sky-600">View Details →</div>
    </Link>
  );
}

function SidePanel({ listings, activeId, onHover, onClose }) {
  return (
    <div className="absolute top-0 right-0 h-full w-72 z-10 bg-white/95 backdrop-blur-sm border-l shadow-xl flex flex-col rounded-r-2xl overflow-hidden">
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
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-semibold text-gray-900 line-clamp-2 leading-snug group-hover:text-primary transition-colors">{l.title}</p>
              <p className="text-[11px] text-gray-500 mt-0.5 truncate">{NEIGHBORHOOD_LABELS[l.neighborhood]}</p>
              <p className="text-xs font-bold text-gray-900 mt-1">
                {l.price_mxn ? `${Number(l.price_mxn).toLocaleString()} MXN` : `$${l.price_usd?.toLocaleString()}`}
                <span className="font-normal text-gray-400">/mo</span>
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

const NEIGHBORHOOD_COORDS = {
  boca_de_tomatlan: [20.5186, -105.3129],
  mismaloya: [20.5317, -105.2892],
  garza_blanca: [20.5593, -105.2673],
  playas_gemelas: [20.5678, -105.2635],
  sierra_del_mar: [20.5702, -105.2575],
  conchas_chinas: [20.5878, -105.2311],
  amapas: [20.5960, -105.2355],
  romantica: [20.6025, -105.2372],
  centro: [20.6120, -105.2335],
  cinco_de_diciembre: [20.6225, -105.2320],
  versalles: [20.6355, -105.2315],
  las_glorias: [20.6288, -105.2356],
  fluvial: [20.6405, -105.2285],
  el_caloso: [20.6085, -105.2232],
  hotel_zone: [20.6300, -105.2410],
  marina_vallarta: [20.6653, -105.2536],
  north_vallarta: [20.6785, -105.2345],
  pitillal: [20.6489, -105.2132],
  nuevo_vallarta: [20.6922, -105.2891],
  flamingos: [20.7185, -105.3054],
  bucerias: [20.7554, -105.3323],
  la_cruz: [20.7297, -105.3789],
  punta_mita: [20.7681, -105.5264],
  sayulita: [20.8689, -105.4408],
};

export default function ListingsMap({ listings }) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  });

  const [activeId, setActiveId] = useState(null);
  const [selectedListing, setSelectedListing] = useState(null);
  const [mapBounds, setMapBounds] = useState(null);
  const [showPanel, setShowPanel] = useState(true);
  const mapRef = useRef(null);

  const withCoords = useMemo(() => {
    return listings.map(l => {
      if (l.latitude && l.longitude) {
        return { ...l, latitude: Number(l.latitude), longitude: Number(l.longitude) };
      }
      
      const defaultCoords = NEIGHBORHOOD_COORDS[l.neighborhood];
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
      return {
        ...l,
        latitude: 20.6534 + latOffset,
        longitude: -105.2253 + lngOffset,
      };
    });
  }, [listings]);

  // Handle auto-fit map center
  const fitMapBounds = useCallback((map) => {
    if (!withCoords.length) return;
    const bounds = new window.google.maps.LatLngBounds();
    withCoords.forEach(l => {
      bounds.extend({ lat: l.latitude, lng: l.longitude });
    });
    map.fitBounds(bounds);
  }, [withCoords]);

  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
    fitMapBounds(map);
    // Track initial bounds
    const googleBounds = map.getBounds();
    if (googleBounds) setMapBounds(googleBounds);
  }, [fitMapBounds]);

  const onBoundsChanged = useCallback(() => {
    if (mapRef.current) {
      const googleBounds = mapRef.current.getBounds();
      if (googleBounds) setMapBounds(googleBounds);
    }
  }, []);

  const visibleListings = useMemo(() => {
    if (!mapBounds) return withCoords;
    return withCoords.filter(l => {
      return mapBounds.contains({ lat: l.latitude, lng: l.longitude });
    });
  }, [withCoords, mapBounds]);

  // Marker Pin Images based on status
  const getMarkerIcon = (listing) => {
    const color = listing.is_featured ? 'gold' : listing.is_verified ? 'blue' : 'black';
    return {
      url: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
      scaledSize: new window.google.maps.Size(25, 41),
      labelOrigin: new window.google.maps.Point(12.5, -15),
    };
  };

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border shadow-sm" style={{ height: 620 }}>
      {withCoords.length === 0 && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-muted/80 rounded-2xl">
          <span className="text-4xl mb-3">🗺️</span>
          <p className="font-semibold text-lg">No map data available</p>
          <p className="text-sm text-muted-foreground mt-1">Listings need coordinates to appear on the map</p>
        </div>
      )}

      {/* Toolbar & toggles */}
      {!showPanel && (
        <button
          onClick={() => setShowPanel(true)}
          className="absolute top-3 right-3 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/90 hover:bg-white text-gray-700 border border-white shadow"
        >
          <MapPin className="w-3.5 h-3.5" /> Show List ({visibleListings.length})
        </button>
      )}

      {isLoaded ? (
        <GoogleMap
          mapContainerStyle={{ height: '100%', width: '100%' }}
          center={PV_CENTER}
          zoom={13}
          onLoad={onMapLoad}
          onBoundsChanged={onBoundsChanged}
          options={{
            fullscreenControl: false,
            mapTypeControl: false,
            streetViewControl: false,
          }}
        >
          {withCoords.map(listing => {
            const priceVal = listing.price_mxn ? Number(listing.price_mxn) : 0;
            const markerLabelText = priceVal ? `${priceVal.toLocaleString()} MXN` : (listing.title || '');

            return (
              <Marker
                key={listing.id}
                position={{ lat: listing.latitude, lng: listing.longitude }}
                icon={getMarkerIcon(listing)}
                label={{
                  text: markerLabelText,
                  color: '#1e293b',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  className: 'bg-white/95 px-2 py-0.5 rounded border border-slate-300 shadow-sm whitespace-nowrap',
                }}
                onClick={() => setSelectedListing(listing)}
                onMouseOver={() => setActiveId(listing.id)}
                onMouseOut={() => setActiveId(null)}
              />
            );
          })}

          {selectedListing && (
            <InfoWindow
              position={{ lat: selectedListing.latitude, lng: selectedListing.longitude }}
              onCloseClick={() => setSelectedListing(null)}
            >
              <div className="p-1">
                <ListingPopupCard listing={selectedListing} />
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      ) : (
        <div className="flex items-center justify-center h-full bg-slate-50 text-muted-foreground text-sm">
          Loading Google Maps...
        </div>
      )}

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
      <div className="absolute bottom-4 left-4 z-10 bg-white/90 backdrop-blur-sm rounded-xl shadow px-3 py-2 text-xs space-y-1 border">
        <div className="flex items-center gap-2"><span className="inline-block w-4 h-3 rounded-full bg-sky-500" /> Verified</div>
        <div className="flex items-center gap-2"><span className="inline-block w-4 h-3 rounded-full bg-amber-400" /> Featured</div>
        <div className="flex items-center gap-2"><span className="inline-block w-4 h-3 rounded-full bg-slate-800" /> Standard</div>
      </div>
    </div>
  );
}
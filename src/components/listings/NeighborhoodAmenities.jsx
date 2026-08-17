import React, { useState } from 'react';
import { MapPin, Loader2, UtensilsCrossed, Heart, Building2, Coffee, ShoppingBag, GraduationCap, Dumbbell, X, Plane } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';

const CATEGORY_ICONS = {
  'Places to Eat': UtensilsCrossed,
  'Hospitals & Clinics': Heart,
  'Doctors & Specialists': Heart,
  'Banks & ATMs': Building2,
  'Coffee Shops': Coffee,
  'Supermarkets & Shopping': ShoppingBag,
  'Schools & Education': GraduationCap,
  'Gyms & Fitness': Dumbbell,
  'Transit & Airports': Plane,
};

const AMENITIES_BY_NEIGHBORHOOD = {
  romantica: {
    'Places to Eat': ['Margarita Grill', 'Joe Jack\'s Fish Shack', 'Fredy\'s Tucan', 'La Palapa', 'Café de Artistes', 'Coco\'s Kitchen', 'Tacos El Cuñado', 'Pancho\'s Takos'],
    'Hospitals & Clinics': ['Hospital Medasist', 'Vallarta Medical Center', 'Cornerstone Hospital', 'Cruz Roja Centro'],
    'Doctors & Specialists': ['Dr. Mauro Valdivia (General)', 'Dr. Laura Garcia (Pediatric)', 'Dr. Octavio Arroyo (Cardiology)', 'Dra. Sylvia Alatorre (Dermatology)'],
    'Banks & ATMs': ['Banorte ATM Olas Altas', 'Santander Bank', 'CI Banco', 'BBVA ATM', 'Banamex ATM'],
    'Coffee Shops': ['A Page in the Sun', 'Starbucks Olas Altas', 'Coexist Café', 'Kaffee Klatsch', 'Espresso Vallarta'],
    'Supermarkets & Shopping': ['Ley Supermarket', 'OXXO Olas Altas', 'Farmacia Guadalajara', 'Organic Select Market', 'Vallarta Yacht Club Mall'],
    'Schools & Education': ['Colegio Juan de la Barrera', 'Private Language Tutors Centro', 'Vallarta Spanish School'],
    'Gyms & Fitness': ['PV Fit Gym', 'Yoga Vallarta', 'The Fit Club Gym', 'Madera Fit']
  },
  versalles: {
    'Places to Eat': ['Barrio Bistro', 'Bonito Kitchen', 'La Lulú Cocina', 'Florios Versalles', 'Ocho Tostadas Versalles', 'Lamara', 'Cha\' Cocina & Café'],
    'Hospitals & Clinics': ['Hospital Joya Marina (Nearby)', 'Clínica Versalles', 'Hospital CMQ Centro (Nearby)', 'Medasist Urgent Care'],
    'Doctors & Specialists': ['Dr. Juan Ramón (General)', 'Dra. Sofia Lopez (Gynecology)', 'Dr. Francisco Ortiz (Orthopedics)', 'Dra. Elena Ruiz (Dentist)'],
    'Banks & ATMs': ['BBVA Bancomer Versalles', 'Banamex ATM', 'HSBC Plaza Caracol', 'Banorte ATM'],
    'Coffee Shops': ['Miscelánea Versalles', 'Café La Vintage', 'Co-Crea Cerámica & Café', 'Café Bigote', 'The Green Place'],
    'Supermarkets & Shopping': ['Soriana Super Playa de Oro', 'Plaza Caracol Mall', 'Costco Wholesale (Nearby)', 'Tiendas Ley (Fluvial)'],
    'Schools & Education': ['Colegio Anglo Colombiano', 'British American School', 'Universidad de Guadalajara (CUC)'],
    'Gyms & Fitness': ['Versalles Fitness Club', 'Dumbbell Gym', 'Fit & Go Studio', 'CrossFit Versalles']
  },
  marina_vallarta: {
    'Places to Eat': ['Porto Bello', 'La Terrazza Di Roma', 'Tintoque', 'Victor\'s Grill', 'La Cevicheria', 'El Coleguita Marina'],
    'Hospitals & Clinics': ['Hospital Joya Marina', 'Clínica Marina', 'San Javier Urgent Care'],
    'Doctors & Specialists': ['Dr. David Martinez (General)', 'Dr. Adrian Romero (Cardiology)', 'Dra. Clara Ruiz (Pediatrics)'],
    'Banks & ATMs': ['BBVA Bancomer Marina', 'Santander Bank', 'HSBC ATM', 'Banorte ATM'],
    'Coffee Shops': ['Starbucks Marina', 'Café Starbucks Plaza Marina', 'La Bistro Coffee'],
    'Supermarkets & Shopping': ['Plaza Marina Mall', 'Walmart (Nearby)', 'Sams Club (Nearby)'],
    'Schools & Education': ['American School of Puerto Vallarta', 'Colegio Greenish'],
    'Gyms & Fitness': ['Marina Fitness Gym', 'Pilates Marina', 'Sport City (Nearby)']
  },
  default: {
    'Places to Eat': ['Pipis', 'Panchos Takos', 'La Palapa', 'Fredys Tucan'],
    'Hospitals & Clinics': ['Hospital Joya', 'Hospital Medasist', 'Vallarta Medical Center'],
    'Doctors & Specialists': ['Dr. Mauro Valdivia', 'Dr. Laura Garcia'],
    'Banks & ATMs': ['Banorte', 'Santander', 'HSBC', 'Banamex'],
    'Coffee Shops': ['Starbucks Centro', 'A Page in the Sun', 'Café de Olla'],
    'Supermarkets & Shopping': ['Soriana', 'Walmart', 'Ley', 'Costco'],
    'Schools & Education': ['Colegio Americano', 'British School'],
    'Gyms & Fitness': ['PV Fit', 'The Fit Club']
  }
};

export default function NeighborhoodAmenities({ neighborhood, neighborhoodLabel, nearbyPlaces, listingLatitude, listingLongitude, propertyTitle }) {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY
  });

  const [open, setOpen] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState(null);

  // Group dynamic nearby places if present
  let hasDynamicPlaces = false;
  let dynamicCategories = {};

  if (Array.isArray(nearbyPlaces) && nearbyPlaces.length > 0) {
    hasDynamicPlaces = true;
    nearbyPlaces.forEach(place => {
      let category = 'Local Attractions';
      const rawType = (place.type || '').toLowerCase();
      const rawName = (place.name || '').toLowerCase();

      if (rawType.includes('restaurant') || rawType.includes('food') || rawType.includes('meal') || rawName.includes('restaurant') || rawName.includes('taco') || rawName.includes('grill') || rawName.includes('cocina')) {
        category = 'Places to Eat';
      } else if (rawType.includes('cafe') || rawType.includes('coffee') || rawName.includes('cafe') || rawName.includes('coffee') || rawName.includes('starbucks')) {
        category = 'Coffee Shops';
      } else if (rawType.includes('bank') || rawType.includes('atm') || rawType.includes('finance') || rawName.includes('bank') || rawName.includes('atm') || rawName.includes('banorte') || rawName.includes('bbva') || rawName.includes('banamex') || rawName.includes('hsbc')) {
        category = 'Banks & ATMs';
      } else if (rawType.includes('gym') || rawType.includes('fitness') || rawName.includes('gym') || rawName.includes('fitness') || rawName.includes('sport')) {
        category = 'Gyms & Fitness';
      } else if (rawType.includes('beauty') || rawType.includes('hair') || rawType.includes('spa') || rawName.includes('beauty') || rawName.includes('salon') || rawName.includes('spa') || rawName.includes('barber')) {
        category = 'Salons & Spas';
      } else if (rawType.includes('park') || rawType.includes('garden') || rawName.includes('park') || rawName.includes('garden') || rawName.includes('plaza')) {
        category = 'Parks & Nature';
      } else if (rawType.includes('mall') || rawType.includes('supermarket') || rawType.includes('store') || rawType.includes('grocery') || rawName.includes('mall') || rawName.includes('supermarket') || rawName.includes('walmart') || rawName.includes('soriana') || rawName.includes('oxxo') || rawName.includes('ley')) {
        category = 'Supermarkets & Shopping';
      } else if (rawType.includes('transit') || rawType.includes('aeroway') || rawType.includes('airport') || rawType.includes('bus') || rawType.includes('station') || rawName.includes('airport') || rawName.includes('bus') || rawName.includes('station') || rawName.includes('terminal')) {
        category = 'Transit & Airports';
      } else if (rawType.includes('cinema') || rawType.includes('movie') || rawType.includes('theater') || rawName.includes('cinema') || rawName.includes('cinepolis') || rawName.includes('theater') || rawName.includes('theatre')) {
        category = 'Cinemas & Entertainment';
      } else if (rawType.includes('hospital') || rawType.includes('doctor') || rawType.includes('health') || rawType.includes('pharmacy') || rawName.includes('hospital') || rawName.includes('clinic') || rawName.includes('doctor') || rawName.includes('medical') || rawName.includes('farmacia')) {
        category = 'Hospitals & Clinics';
      } else if (rawType.includes('museum') || rawType.includes('tourist') || rawType.includes('attraction') || rawType.includes('viewpoint') || rawName.includes('museum') || rawName.includes('attraction') || rawName.includes('viewpoint') || rawName.includes('mirador') || rawName.includes('gallery') || rawName.includes('art')) {
        category = 'Tourist Attractions';
      }

      if (!dynamicCategories[category]) {
        dynamicCategories[category] = [];
      }
      dynamicCategories[category].push(place.name);
    });
  }

  const key = neighborhood && AMENITIES_BY_NEIGHBORHOOD[neighborhood] ? neighborhood : 'default';
  const staticData = AMENITIES_BY_NEIGHBORHOOD[key];
  const displayData = hasDynamicPlaces ? dynamicCategories : staticData;

  const mapCenter = listingLatitude && listingLongitude ? { lat: Number(listingLatitude), lng: Number(listingLongitude) } : { lat: 20.6534, lng: -105.2253 };

  return (
    <>
      <Button variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
        <MapPin className="w-4 h-4" /> Nearby Amenities
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setOpen(false)}>
          <div
            className="bg-card rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-card border-b px-6 py-4 flex items-center justify-between rounded-t-2xl z-10">
              <div>
                <h2 className="text-lg font-bold">Nearby Amenities</h2>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> {neighborhoodLabel}, Puerto Vallarta
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="p-2 rounded-full hover:bg-muted transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6 text-gray-900">
              {/* Map displaying the property and nearby locations */}
              {listingLatitude && listingLongitude && (
                <div className="h-80 rounded-xl overflow-hidden border border-slate-200 relative z-10">
                  {isLoaded ? (
                    <GoogleMap
                      mapContainerStyle={{ height: '100%', width: '100%' }}
                      center={mapCenter}
                      zoom={14}
                      options={{
                        fullscreenControl: false,
                        mapTypeControl: false,
                        streetViewControl: false,
                      }}
                    >
                      {/* Property Marker */}
                      <Marker
                        position={mapCenter}
                        icon={{
                          url: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
                          scaledSize: new window.google.maps.Size(25, 41),
                        }}
                        label={{
                          text: propertyTitle || 'Property Location',
                          color: '#b91c1c',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          className: 'bg-red-50/95 px-2 py-0.5 rounded border border-red-300 shadow-sm whitespace-nowrap',
                        }}
                        onClick={() => setSelectedPlace({ name: propertyTitle || 'Property Location', type: 'Target' })}
                      />

                      {/* Nearby Landmark Markers */}
                      {Array.isArray(nearbyPlaces) && nearbyPlaces.map((place, idx) => {
                        if (!place.lat || !place.lon) return null;
                        const markerLatLng = { lat: Number(place.lat), lng: Number(place.lon) };

                        return (
                          <Marker
                            key={idx}
                            position={markerLatLng}
                            icon={{
                              url: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                              scaledSize: new window.google.maps.Size(25, 41),
                            }}
                            label={{
                              text: place.name,
                              color: '#1d4ed8',
                              fontSize: '10px',
                              fontWeight: 'semibold',
                              className: 'bg-blue-50/95 px-1.5 py-0.5 rounded border border-blue-300 shadow-sm whitespace-nowrap',
                            }}
                            onClick={() => setSelectedPlace(place)}
                          />
                        );
                      })}

                      {selectedPlace && (
                        <InfoWindow
                          position={selectedPlace.lat && selectedPlace.lon ? { lat: Number(selectedPlace.lat), lng: Number(selectedPlace.lon) } : mapCenter}
                          onCloseClick={() => setSelectedPlace(null)}
                        >
                          <div className="p-1 text-slate-800">
                            <span className="font-bold block text-xs">{selectedPlace.name}</span>
                            <span className="text-[10px] text-muted-foreground capitalize">{selectedPlace.type || 'Attraction'}</span>
                          </div>
                        </InfoWindow>
                      )}
                    </GoogleMap>
                  ) : (
                    <div className="flex items-center justify-center h-full bg-slate-50 text-muted-foreground text-sm">
                      Loading Maps...
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {Object.entries(displayData).map(([category, places]) => {
                  if (!places?.length) return null;
                  const Icon = CATEGORY_ICONS[category] || MapPin;
                  return (
                    <div key={category} className="rounded-xl border bg-muted/40 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="p-1.5 rounded-lg bg-primary/10">
                          <Icon className="w-4 h-4 text-primary" />
                        </div>
                        <h3 className="font-semibold text-sm">{category}</h3>
                      </div>
                      <ul className="space-y-1.5">
                        {places.map((place, i) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                            <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary/50 shrink-0" />
                            {place}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="text-center text-xs text-muted-foreground pb-4 px-6">
              Data sourced from public information and may not reflect current business status.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
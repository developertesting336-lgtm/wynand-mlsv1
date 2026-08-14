import React, { useState } from 'react';
import { MapPin, Loader2, UtensilsCrossed, Heart, Building2, Coffee, ShoppingBag, GraduationCap, Dumbbell, X, Plane } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Custom red icon for the property itself
const propertyIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

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

// Offline static dictionary mapping neighborhood keys to notable local PV establishments
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
    'Places to Eat': ['La Terrazza di Roma', 'Porto Bello', 'Mikado', 'El Coleguita Marina', 'Benitto\'s Paninoteca', 'Victor\'s Tacorriendo'],
    'Hospitals & Clinics': ['Hospital Joya Marina', 'Hospiten Puerto Vallarta', 'San Javier Medical Clinic'],
    'Doctors & Specialists': ['Dr. Jorge Sanchez (Internal Medicine)', 'Pediatric Clinic Marina', 'Dr. Luis Rodriguez (Dentist)', 'Dra. Maria Gomez (Dermatology)'],
    'Banks & ATMs': ['HSBC Marina', 'Banorte ATM', 'Scotiabank Marina', 'Santander Plaza Marina', 'BBVA ATM'],
    'Coffee Shops': ['Starbucks Marina', 'Café Kafé', 'D\'Paola Marina', 'Organic Cup Marina'],
    'Supermarkets & Shopping': ['Walmart Marina', 'Sam\'s Club', 'Plaza Marina Shopping Mall', 'Farmacia Guadalajara Marina'],
    'Schools & Education': ['American School of Puerto Vallarta', 'Colegio Green Forest'],
    'Gyms & Fitness': ['Fitness Vallarta', 'Marina Gym', 'Pilates Vallarta', 'RHYTHM Cycling Studio']
  },
  centro: {
    'Places to Eat': ['Café des Artistes', 'Pipino\'s Centro', 'El Arrayán', 'La Dolce Vita Centro', 'Barcelona Tapas', 'La Cappella', 'Pipis Mexican Restaurant'],
    'Hospitals & Clinics': ['Centro de Salud Centro', 'Red Cross Clinic Centro', 'Hospital CMQ Centro'],
    'Doctors & Specialists': ['Dra. Ana Maria (Pediatrician)', 'Dr. Carlos Mendoza (Cardiology)', 'Dr. Daniel Ramos (Dentist)'],
    'Banks & ATMs': ['Bancomer Centro', 'Santander Centro', 'Banorte Centro', 'Banco del Bienestar'],
    'Coffee Shops': ['Café de Olla', 'Starbucks Malecón', 'Cacao Papalotl', 'Café de la Misión', 'Mi Café'],
    'Supermarkets & Shopping': ['Mercado Municipal Centro', 'Kiosko Centro', 'Farmacia del Ahorro', 'Ley Centro', 'Artesanías Vallarta Market'],
    'Schools & Education': ['Escuela Primaria 15 de Mayo', 'Centro Escolar Juana de Asbaje'],
    'Gyms & Fitness': ['Centro Fitness', 'CrossFit Vallarta', 'Malecon Outdoor Gym', 'Spinning Center Centro']
  },
  amapas: {
    'Places to Eat': ['El Panorama', 'La Palapa (Nearby)', 'Swell Beach Club', 'Pinnacle Sky Bar', 'Coco\'s Kitchen (Nearby)', 'Barcelona Tapas (Nearby)'],
    'Hospitals & Clinics': ['Hospital Medasist (Nearby)', 'Vallarta Medical Center (Nearby)', 'Hospital CMQ Centro (Nearby)'],
    'Doctors & Specialists': ['Local specialists in adjacent Zona Romántica', 'Dr. Mauro Valdivia (Nearby)'],
    'Banks & ATMs': ['Banorte ATM Olas Altas', 'Intercam Bank', 'Santander Olas Altas'],
    'Coffee Shops': ['A Page in the Sun', 'Coco\'s Kitchen (Nearby)', 'Kaffee Klatsch (Nearby)'],
    'Supermarkets & Shopping': ['OXXO Amapas', 'Ley Supermarket (Centro)', 'Farmacia Guadalajara Olas Altas'],
    'Schools & Education': ['Local schools in nearby Centro & Zona Romántica'],
    'Gyms & Fitness': ['PV Fit Gym', 'Yoga Vallarta', 'The Fit Club Gym (Nearby)']
  },
  fluvial: {
    'Places to Eat': ['Mariscos 8 Tostadas Fluvial', 'Tacos El Carboncito', 'La Vaca Argentina', 'Red Cabbage Café', 'Mora Sushi Fluvial'],
    'Hospitals & Clinics': ['Hospital Joya Vallarta', 'Clínica Versalles (Nearby)', 'Hospiten (Nearby)'],
    'Doctors & Specialists': ['Specialist offices in Plaza Caracol', 'Dr. Francisco Ortiz (Nearby)'],
    'Banks & ATMs': ['Santander Fluvial', 'BBVA Fluvial', 'Banorte Fluvial', 'Scotiabank Fluvial'],
    'Coffee Shops': ['Starbucks Fluvial', 'Café La Flor de Córdoba', 'Le Café Fluvial'],
    'Supermarkets & Shopping': ['Costco Wholesale', 'La Comer Fluvial', 'Soriana Híper Fluvial', 'Plaza Caracol Mall'],
    'Schools & Education': ['Colegio Ameyali', 'Instituto Anglo-Mexicano', 'Universidad UNIVER'],
    'Gyms & Fitness': ['Smart Fit Fluvial', 'Anytime Fitness Fluvial', 'Spinning Fluvial', 'Fluvial Cross training']
  },
  hotel_zone: {
    'Places to Eat': ['La Leche', 'La Docena', 'Porfirio\'s Vallarta', 'Campomar', 'The Iguana Restaurant', 'Food Park PV'],
    'Hospitals & Clinics': ['Hospital Joya (Zone)', 'Hospiten Puerto Vallarta', 'Medasist Clinic (Nearby)'],
    'Doctors & Specialists': ['Dra. Gabriela Diaz (General)', 'Dr. Roberto Cruz (Internal Medicine)', 'Dentist Plaza Caracol'],
    'Banks & ATMs': ['BBVA Plaza Caracol', 'HSBC Hotel Zone', 'Banorte ATM', 'Santander Peninsula Plaza'],
    'Coffee Shops': ['Starbucks Peninsula', 'Café des Artistes (Malecón branch)', 'The Coffee Cup Plaza Caracol'],
    'Supermarkets & Shopping': ['Soriana Super Playa de Oro', 'La Comer Fluvial (Nearby)', 'Peninsula Plaza Mall', 'Plaza Caracol Mall'],
    'Schools & Education': ['British American School (Nearby)', 'Colegio Jean Piaget'],
    'Gyms & Fitness': ['Smart Fit Plaza Caracol', 'Gym Hotel Zone', 'CrossFit Hotel Zone']
  },
  default: {
    'Places to Eat': ['Local Restaurants & Taquerías', 'Beachfront Eateries', 'International Restaurants'],
    'Hospitals & Clinics': ['Regional Medical Centers', 'Urgent Care Clinics'],
    'Doctors & Specialists': ['Local General Doctors', 'Dentists & Dental Clinics'],
    'Banks & ATMs': ['Local ATM Stations', 'National Bank Branches'],
    'Coffee Shops': ['Local Cafés & Bakeries'],
    'Supermarkets & Shopping': ['Local Convenience Stores (OXXO/Kiosko)', 'Supermarkets & Fresh Food Markets'],
    'Schools & Education': ['Local Neighborhood Schools', 'Spanish Language Academies'],
    'Gyms & Fitness': ['Local Parks & Fitness Centers', 'Yoga & Pilates Studios', 'CrossFit Gyms']
  }
};

export default function NeighborhoodAmenities({ neighborhood, neighborhoodLabel, nearbyPlaces, listingLatitude, listingLongitude, propertyTitle }) {
  const [open, setOpen] = useState(false);

  // Group dynamic nearby places if present
  let hasDynamicPlaces = false;
  let dynamicCategories = {};

  if (Array.isArray(nearbyPlaces) && nearbyPlaces.length > 0) {
    hasDynamicPlaces = true;
    nearbyPlaces.forEach(place => {
      // Map raw osm tags/types to readable categories
      let category = 'Local Attractions';
      const rawType = (place.type || '').toLowerCase();
      if (rawType.includes('bank')) {
        category = 'Banks & ATMs';
      } else if (rawType.includes('gym') || rawType.includes('fitness')) {
        category = 'Gyms & Fitness';
      } else if (rawType.includes('beauty') || rawType.includes('salon')) {
        category = 'Salons & Spas';
      } else if (rawType.includes('park') || rawType.includes('garden')) {
        category = 'Parks & Nature';
      } else if (rawType.includes('mall') || rawType.includes('supermarket')) {
        category = 'Shopping & Malls';
      } else if (rawType.includes('aeroway') || rawType.includes('aerodrome') || rawType.includes('terminal') || rawType.includes('railway') || rawType.includes('station') || rawType.includes('bus_station')) {
        category = 'Transit & Airports';
      } else if (rawType.includes('museum') || rawType.includes('attraction') || rawType.includes('viewpoint')) {
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

  const mapCenter = listingLatitude && listingLongitude ? [Number(listingLatitude), Number(listingLongitude)] : [20.6534, -105.2253];

  // Custom function to create labeled markers
  const createLabeledIcon = (name, subLabel, isProp = false) => {
    const markerUrl = isProp
      ? 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png'
      : 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png';

    return L.divIcon({
      className: '',
      html: `
        <div style="position:relative; width:25px; height:41px;">
          <!-- Leaflet Pin Marker Image -->
          <img src="${markerUrl}" style="width:25px; height:41px; display:block;" />
          
          <!-- Text Label outside / above the pin -->
          <div style="
            position:absolute;
            bottom:45px;
            left:50%;
            transform:translateX(-50%);
            background:rgba(255, 255, 255, 0.95);
            color:#1e293b;
            font-weight:700;
            font-size:10px;
            padding:3px 6px;
            border-radius:4px;
            box-shadow:0 2px 6px rgba(0,0,0,0.15);
            border:1px solid #cbd5e1;
            pointer-events:none;
            text-align:center;
            white-space:nowrap;
          ">
            <div style="max-width:140px; text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${name}</div>
            ${subLabel ? `<div style="font-size:9.5px; font-weight:600; opacity:0.75; margin-top:1px; text-transform:capitalize;">${subLabel}</div>` : ''}
          </div>
        </div>
      `,
      iconSize: [25, 41],
      iconAnchor: [12, 41],
      popupAnchor: [1, -34],
    });
  };

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
            <div className="p-6 space-y-6">
              {/* Map displaying the property and nearby locations */}
              {listingLatitude && listingLongitude && (
                <div className="h-80 rounded-xl overflow-hidden border border-slate-200 relative z-10">
                  <MapContainer center={mapCenter} zoom={14} style={{ height: '100%', width: '100%' }}>
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    {/* The property itself */}
                    <Marker position={mapCenter} icon={createLabeledIcon(propertyTitle || 'Property Location', 'Target', true)}>
                      <Popup>
                        <div className="font-semibold text-sm">{propertyTitle || 'Property Location'}</div>
                      </Popup>
                    </Marker>

                    {/* Nearby landmarks */}
                    {Array.isArray(nearbyPlaces) && nearbyPlaces.map((place, idx) => {
                      if (!place.lat || !place.lon) return null;
                      return (
                        <Marker key={idx} position={[Number(place.lat), Number(place.lon)]} icon={createLabeledIcon(place.name, place.type)}>
                          <Popup>
                            <div className="text-xs">
                              <span className="font-bold block">{place.name}</span>
                              <span className="text-muted-foreground capitalize">{place.type || 'Attraction'}</span>
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })}
                  </MapContainer>
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
import React, { useState } from 'react';
import { MapPin, Loader2, UtensilsCrossed, Heart, Building2, Coffee, ShoppingBag, GraduationCap, Dumbbell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CATEGORY_ICONS = {
  'Places to Eat': UtensilsCrossed,
  'Hospitals & Clinics': Heart,
  'Doctors & Specialists': Heart,
  'Banks & ATMs': Building2,
  'Coffee Shops': Coffee,
  'Supermarkets & Shopping': ShoppingBag,
  'Schools & Education': GraduationCap,
  'Gyms & Fitness': Dumbbell,
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

export default function NeighborhoodAmenities({ neighborhood, neighborhoodLabel }) {
  const [open, setOpen] = useState(false);

  const key = neighborhood && AMENITIES_BY_NEIGHBORHOOD[neighborhood] ? neighborhood : 'default';
  const data = AMENITIES_BY_NEIGHBORHOOD[key];

  return (
    <>
      <Button variant="outline" size="sm" className="gap-2" onClick={() => setOpen(true)}>
        <MapPin className="w-4 h-4" /> Nearby Amenities
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setOpen(false)}>
          <div
            className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
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
            <div className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                {Object.entries(data).map(([category, places]) => {
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
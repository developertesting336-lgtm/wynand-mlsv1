export const NEIGHBORHOODS = [
  // SOUTH SHORE
  { value: 'boca_de_tomatlan', label: 'Boca de Tomatlán' },
  { value: 'mismaloya', label: 'Mismaloya' },
  { value: 'garza_blanca', label: 'Garza Blanca' },
  { value: 'playas_gemelas', label: 'Playas Gemelas' },
  { value: 'sierra_del_mar', label: 'Sierra del Mar' },

  // CENTRAL / OLD TOWN
  { value: 'conchas_chinas', label: 'Conchas Chinas' },
  { value: 'amapas', label: 'Amapas' },
  { value: 'romantica', label: 'Zona Romántica' },
  { value: 'centro', label: 'Centro' },
  { value: 'cinco_de_diciembre', label: '5 de Diciembre' },

  // CENTRAL VALLARTA
  { value: 'versalles', label: 'Versalles' },
  { value: 'las_glorias', label: 'Las Glorias' },
  { value: 'fluvial', label: 'Fluvial' },
  { value: 'el_caloso', label: 'El Caloso' },

  // NORTH SHORE
  { value: 'hotel_zone', label: 'Hotel Zone' },
  { value: 'marina_vallarta', label: 'Marina Vallarta' },
  { value: 'north_vallarta', label: 'North Vallarta' },
  { value: 'pitillal', label: 'Pitillal' },

  // RIVIERA NAYARIT
  { value: 'nuevo_vallarta', label: 'Nuevo Vallarta' },
  { value: 'flamingos', label: 'Flamingos' },
  { value: 'bucerias', label: 'Bucerías' },
  { value: 'la_cruz', label: 'La Cruz' },
  { value: 'punta_mita', label: 'Punta Mita' },
  { value: 'sayulita', label: 'Sayulita' },

  { value: 'other', label: 'Other' },
];

export const NEIGHBORHOOD_LABELS = NEIGHBORHOODS.reduce((acc, n) => {
  acc[n.value] = n.label;
  return acc;
}, {});

export const GROUPED_NEIGHBORHOODS = [
  {
    label: 'South Shore',
    options: [
      { value: 'boca_de_tomatlan', label: 'Boca de Tomatlán' },
      { value: 'mismaloya', label: 'Mismaloya' },
      { value: 'garza_blanca', label: 'Garza Blanca' },
      { value: 'playas_gemelas', label: 'Playas Gemelas' },
      { value: 'sierra_del_mar', label: 'Sierra del Mar' },
    ]
  },
  {
    label: 'Central / Old Town',
    options: [
      { value: 'conchas_chinas', label: 'Conchas Chinas' },
      { value: 'amapas', label: 'Amapas' },
      { value: 'romantica', label: 'Zona Romántica' },
      { value: 'centro', label: 'Centro' },
      { value: 'cinco_de_diciembre', label: '5 de Diciembre' },
    ]
  },
  {
    label: 'Central Vallarta',
    options: [
      { value: 'versalles', label: 'Versalles' },
      { value: 'las_glorias', label: 'Las Glorias' },
      { value: 'fluvial', label: 'Fluvial' },
      { value: 'el_caloso', label: 'El Caloso' },
    ]
  },
  {
    label: 'North Shore',
    options: [
      { value: 'hotel_zone', label: 'Hotel Zone' },
      { value: 'marina_vallarta', label: 'Marina Vallarta' },
      { value: 'north_vallarta', label: 'North Vallarta' },
      { value: 'pitillal', label: 'Pitillal' },
    ]
  },
  {
    label: 'Riviera Nayarit',
    options: [
      { value: 'nuevo_vallarta', label: 'Nuevo Vallarta' },
      { value: 'flamingos', label: 'Flamingos' },
      { value: 'bucerias', label: 'Bucerías' },
      { value: 'la_cruz', label: 'La Cruz' },
      { value: 'punta_mita', label: 'Punta Mita' },
      { value: 'sayulita', label: 'Sayulita' },
    ]
  },
  {
    label: 'Other',
    options: [
      { value: 'other', label: 'Other' }
    ]
  }
];

export const FURNISHED_OPTIONS = [
  { value: 'furnished', label: 'Furnished' },
  { value: 'unfurnished', label: 'Unfurnished' },
  { value: 'partially_furnished', label: 'Partially Furnished' },
];

export const RENTAL_TYPES = [
  { value: 'short_term', label: 'Short-term' },
  { value: 'long_term', label: 'Long-term' },
  { value: 'both', label: 'Both' },
];
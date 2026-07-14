export const NEIGHBORHOODS = [
  { value: 'romantica', label: 'Zona Romántica' },
  { value: 'marina_vallarta', label: 'Marina Vallarta' },
  { value: 'nuevo_vallarta', label: 'Nuevo Vallarta' },
  { value: 'centro', label: 'Centro' },
  { value: 'amapas', label: 'Amapas' },
  { value: 'conchas_chinas', label: 'Conchas Chinas' },
  { value: 'fluvial', label: 'Fluvial' },
  { value: 'versalles', label: 'Versalles' },
  { value: 'pitillal', label: 'Pitillal' },
  { value: 'las_juntas', label: 'Las Juntas' },
  { value: 'hotel_zone', label: 'Hotel Zone' },
  { value: 'south_side', label: 'South Side' },
  { value: 'bucerias', label: 'Bucerias' },
  { value: 'la_cruz', label: 'La Cruz' },
  { value: 'punta_mita', label: 'Punta Mita' },
  { value: 'sayulita', label: 'Sayulita' },
  { value: 'cinco_de_diciembre', label: 'Cinco de Diciembre' },
  { value: 'alta_vista', label: 'Alta Vista' },
  { value: 'lazaro_cardenas', label: 'Lazaro Cardenas' },
  { value: 'other', label: 'Other' },
];

export const NEIGHBORHOOD_LABELS = NEIGHBORHOODS.reduce((acc, n) => {
  acc[n.value] = n.label;
  return acc;
}, {});

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
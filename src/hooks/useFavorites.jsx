import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useFavorites(userId) {
  const queryClient = useQueryClient();

  const { data: favorites = [] } = useQuery({
    queryKey: ['favorites', userId],
    queryFn: () => base44.entities.Favorite.filter({ user_id: userId }),
    enabled: !!userId,
  });

  const favoriteIds = new Set(favorites.map(f => f.listing_id));

  const toggle = useMutation({
    mutationFn: async (listingId) => {
      const existing = favorites.find(f => f.listing_id === listingId);
      if (existing) {
        await base44.entities.Favorite.delete(existing.id);
      } else {
        await base44.entities.Favorite.create({ listing_id: listingId, user_id: userId });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['favorites', userId] }),
  });

  return { favorites, favoriteIds, toggle };
}

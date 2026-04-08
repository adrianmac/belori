import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function useInventoryROI() {
  const { boutique } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!boutique?.id) return;
    setLoading(true);
    setError(null);

    Promise.all([
      supabase
        .from('inventory')
        .select('id, name, sku, price, category, created_at')
        .eq('boutique_id', boutique.id)
        .in('category', ['bridal_gown', 'quince_gown']),
      supabase
        .from('event_inventory')
        .select('inventory_id, event_id, events(paid, total, event_date)')
        .eq('boutique_id', boutique.id),
    ]).then(([{ data: items, error: e1 }, { data: assignments, error: e2 }]) => {
      if (e1) { setError(e1.message); setLoading(false); return; }
      if (e2) { setError(e2.message); setLoading(false); return; }

      const allItems = items || [];
      const allAssignments = assignments || [];

      const now = new Date();
      const sixMonthsAgo = new Date(now);
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const result = allItems.map(item => {
        const itemAssignments = allAssignments.filter(a => a.inventory_id === item.id);
        const rentalCount = itemAssignments.length;

        // Group assignments by event to avoid double-counting
        const eventMap = {};
        for (const a of itemAssignments) {
          const evId = a.event_id;
          if (!evId) continue;
          if (!eventMap[evId]) eventMap[evId] = { paid: Number(a.events?.paid || 0), total: Number(a.events?.total || 0), date: a.events?.event_date };
        }

        // For each event, estimate revenue contribution as paid / number of items in that event
        let totalRevenue = 0;
        for (const [evId, ev] of Object.entries(eventMap)) {
          const evItemCount = Math.max(allAssignments.filter(a => a.event_id === evId).length, 1);
          totalRevenue += ev.paid / evItemCount;
        }

        const roi = item.price > 0 ? (totalRevenue / item.price) * 100 : 0;

        // Utilization: rentals per month since item was added
        const createdAt = item.created_at ? new Date(item.created_at) : new Date(now.getFullYear() - 1, 0, 1);
        const monthsOwned = Math.max((now - createdAt) / (1000 * 60 * 60 * 24 * 30.44), 1);
        const utilizationRate = rentalCount / monthsOwned;

        // Recent activity for deadstock detection
        const recentRentals = itemAssignments.filter(a => {
          const d = a.events?.event_date;
          return d && new Date(d) >= sixMonthsAgo;
        });
        const isDeadstock = rentalCount === 0 || recentRentals.length === 0;

        return {
          item,
          rentalCount,
          totalRevenue,
          roi,
          utilizationRate,
          isDeadstock,
          monthsOwned,
        };
      });

      result.sort((a, b) => b.roi - a.roi);
      setData(result);
      setLoading(false);
    });
  }, [boutique?.id]);

  return { data, loading, error };
}

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

// ─── useStaffAvailability ─────────────────────────────────────────────────────
// Fetches weekly availability schedules + blockout dates for a boutique.
// If userId is provided, filters to just that staff member.
export function useStaffAvailability(userId = null) {
  const { boutique } = useAuth();
  const [availability, setAvailability] = useState([]); // [{staff_id, day_of_week, start_time, end_time, available}]
  const [blockouts, setBlockouts] = useState([]);        // [{id, user_id, start_date, end_date, reason}]
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!boutique?.id) return;
    setLoading(true);

    const avQuery = supabase
      .from('staff_availability')
      .select('id, staff_id, day_of_week, start_time, end_time, available')
      .eq('boutique_id', boutique.id);
    if (userId) avQuery.eq('staff_id', userId);

    const blQuery = supabase
      .from('staff_blockouts')
      .select('id, user_id, start_date, end_date, reason, created_at')
      .eq('boutique_id', boutique.id)
      .order('start_date', { ascending: true });
    if (userId) blQuery.eq('user_id', userId);

    const [{ data: avData }, { data: blData }] = await Promise.all([avQuery, blQuery]);

    setAvailability(avData || []);
    setBlockouts(blData || []);
    setLoading(false);
  }, [boutique?.id, userId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Save weekly schedule for a staff member (upsert all 7 days)
  const saveAvailability = useCallback(async (staffId, slots) => {
    if (!boutique?.id) return { error: new Error('No boutique') };
    // Delete existing then insert fresh (upsert may fail without unique constraint in older envs)
    await supabase
      .from('staff_availability')
      .delete()
      .eq('boutique_id', boutique.id)
      .eq('staff_id', staffId);

    const rows = slots.map(s => ({
      boutique_id: boutique.id,
      staff_id: staffId,
      day_of_week: s.day_of_week,
      start_time: s.start_time,
      end_time: s.end_time,
      available: s.is_available !== undefined ? s.is_available : s.available !== false,
    }));
    const { error } = await supabase.from('staff_availability').insert(rows);
    if (!error) {
      setAvailability(prev => [
        ...prev.filter(a => a.staff_id !== staffId),
        ...rows.map((r, i) => ({ ...r, id: String(i) })),
      ]);
    }
    return { error };
  }, [boutique?.id]);

  // Add a blockout date range for a staff member
  const addBlockout = useCallback(async ({ user_id, start_date, end_date, reason }) => {
    if (!boutique?.id) return { error: new Error('No boutique') };
    const { data, error } = await supabase
      .from('staff_blockouts')
      .insert({ boutique_id: boutique.id, user_id, start_date, end_date, reason: reason || null })
      .select()
      .single();
    if (!error && data) {
      setBlockouts(prev => [...prev, data].sort((a, b) => a.start_date.localeCompare(b.start_date)));
    }
    return { data, error };
  }, [boutique?.id]);

  // Remove a blockout by id
  const removeBlockout = useCallback(async (id) => {
    if (!boutique?.id) return { error: new Error('No boutique') };
    const { error } = await supabase
      .from('staff_blockouts')
      .delete()
      .eq('id', id)
      .eq('boutique_id', boutique.id);
    if (!error) setBlockouts(prev => prev.filter(b => b.id !== id));
    return { error };
  }, [boutique?.id]);

  // Check if a staff member is available on a given date + time
  // Returns { available: bool, reason: string }
  const isStaffAvailable = useCallback(async (staffId, date, time) => {
    if (!boutique?.id || !staffId || !date) return { available: true, reason: '' };

    // 1. Check blockouts
    const { data: bls } = await supabase
      .from('staff_blockouts')
      .select('id, start_date, end_date, reason')
      .eq('boutique_id', boutique.id)
      .eq('user_id', staffId)
      .lte('start_date', date)
      .gte('end_date', date);

    if (bls && bls.length > 0) {
      const bl = bls[0];
      const reasonTxt = bl.reason ? ` (${bl.reason})` : '';
      return { available: false, reason: `on time off${reasonTxt}` };
    }

    // 2. Check day-of-week schedule
    const dayOfWeek = new Date(date + 'T12:00:00').getDay(); // 0=Sun..6=Sat
    const { data: schedule } = await supabase
      .from('staff_availability')
      .select('available, start_time, end_time')
      .eq('boutique_id', boutique.id)
      .eq('staff_id', staffId)
      .eq('day_of_week', dayOfWeek)
      .maybeSingle();

    if (schedule && !schedule.available) {
      const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return { available: false, reason: `not scheduled on ${DAY_NAMES[dayOfWeek]}s` };
    }

    // 3. Check appointment load (busy if 3+ on that day)
    const { data: appts } = await supabase
      .from('appointments')
      .select('id')
      .eq('boutique_id', boutique.id)
      .eq('staff_id', staffId)
      .eq('date', date)
      .neq('status', 'cancelled');

    const count = (appts || []).length;
    if (count >= 3) {
      return { available: true, busy: true, reason: `has a heavy schedule this day (${count} appointments)` };
    }

    return { available: true, busy: false, reason: '' };
  }, [boutique?.id]);

  return {
    availability,
    blockouts,
    loading,
    saveAvailability,
    addBlockout,
    removeBlockout,
    isStaffAvailable,
    refetch: fetchAll,
  };
}

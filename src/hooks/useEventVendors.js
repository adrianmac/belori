import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function useEventVendors(eventId) {
  const { boutique } = useAuth();
  const [eventVendors, setEventVendors] = useState([]);
  const [allVendors, setAllVendors] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchEventVendors = useCallback(async () => {
    if (!eventId || !boutique?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('event_vendors')
      .select('*, vendor:vendors(id, name, category, phone, email, contact_name, rating)')
      .eq('event_id', eventId)
      .eq('boutique_id', boutique.id)
      .order('created_at', { ascending: true });
    setEventVendors(data || []);
    setLoading(false);
  }, [eventId, boutique?.id]);

  const fetchAllVendors = useCallback(async () => {
    if (!boutique?.id) return;
    const { data } = await supabase
      .from('vendors')
      .select('id, name, category, phone, email, contact_name, rating')
      .eq('boutique_id', boutique.id)
      .order('name', { ascending: true });
    setAllVendors(data || []);
  }, [boutique?.id]);

  useEffect(() => { fetchEventVendors(); fetchAllVendors(); }, [fetchEventVendors, fetchAllVendors]);

  const addVendor = useCallback(async ({ vendor_id, role, fee, notes, status }) => {
    if (!boutique?.id || !eventId) return { error: 'Missing context' };
    const { error } = await supabase.from('event_vendors').insert({
      boutique_id: boutique.id,
      event_id: eventId,
      vendor_id,
      role: role || null,
      fee: fee || null,
      notes: notes || null,
      status: status || 'confirmed',
    });
    if (!error) fetchEventVendors();
    return { error };
  }, [boutique?.id, eventId, fetchEventVendors]);

  const updateVendor = useCallback(async (id, patch) => {
    const { error } = await supabase.from('event_vendors').update(patch).eq('id', id).eq('boutique_id', boutique.id);
    if (!error) fetchEventVendors();
    return { error };
  }, [boutique?.id, fetchEventVendors]);

  const removeVendor = useCallback(async (id) => {
    const { error } = await supabase.from('event_vendors').delete().eq('id', id).eq('boutique_id', boutique.id);
    if (!error) fetchEventVendors();
    return { error };
  }, [boutique?.id, fetchEventVendors]);

  return { eventVendors, allVendors, loading, addVendor, updateVendor, removeVendor, refresh: fetchEventVendors };
}

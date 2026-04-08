import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function useDamageReports(inventoryId) {
  const { boutique } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [tableExists, setTableExists] = useState(true);

  const fetch = useCallback(async () => {
    if (!boutique?.id) return;
    setLoading(true);
    let q = supabase
      .from('damage_reports')
      .select('*')
      .eq('boutique_id', boutique.id)
      .order('reported_at', { ascending: false });
    if (inventoryId) q = q.eq('inventory_id', inventoryId);
    const { data, error } = await q;
    if (error) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        setTableExists(false);
      }
    } else {
      setReports(data || []);
    }
    setLoading(false);
  }, [boutique?.id, inventoryId]);

  useEffect(() => { fetch(); }, [fetch]);

  const createDamageReport = useCallback(async (payload) => {
    if (!boutique?.id) return { error: 'No boutique' };
    const { data, error } = await supabase
      .from('damage_reports')
      .insert({ ...payload, boutique_id: boutique.id })
      .select()
      .single();
    if (!error) setReports(prev => [data, ...prev]);
    return { data, error };
  }, [boutique?.id]);

  const updateDamageReport = useCallback(async (id, changes) => {
    const { data, error } = await supabase
      .from('damage_reports')
      .update(changes)
      .eq('id', id)
      .select()
      .single();
    if (!error) {
      setReports(prev => prev.map(r => r.id === id ? data : r));
    }
    return { data, error };
  }, []);

  const uploadDamagePhoto = useCallback(async (file, reportId) => {
    const ext = file.name.split('.').pop().replace(/[^a-z0-9]/gi, '');
    const filename = `${boutique?.id || 'dmg'}/${reportId || Date.now()}/${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from('damage-photos')
      .upload(filename, file, { contentType: file.type, upsert: true });
    if (upErr) return { url: null, error: upErr };
    const { data: { publicUrl } } = supabase.storage
      .from('damage-photos')
      .getPublicUrl(filename);
    return { url: publicUrl, error: null };
  }, [boutique?.id]);

  return { reports, loading, tableExists, refetch: fetch, createDamageReport, updateDamageReport, uploadDamagePhoto };
}

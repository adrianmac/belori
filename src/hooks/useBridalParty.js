import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export function useBridalParty(eventId) {
  const { boutique } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!eventId || !boutique?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('bridal_party')
      .select('*')
      .eq('event_id', eventId)
      .eq('boutique_id', boutique.id)
      .order('created_at', { ascending: true });
    setMembers(data || []);
    setLoading(false);
  }, [eventId, boutique?.id]);

  useEffect(() => { fetch(); }, [fetch]);

  async function addMember(payload) {
    if (!boutique?.id || !eventId) return { error: new Error('Missing context') };
    const { data, error } = await supabase
      .from('bridal_party')
      .insert({ ...payload, boutique_id: boutique.id, event_id: eventId })
      .select()
      .single();
    if (!error) setMembers(ms => [...ms, data]);
    return { data, error };
  }

  async function updateMember(id, changes) {
    const { data, error } = await supabase
      .from('bridal_party')
      .update(changes)
      .eq('id', id)
      .select()
      .single();
    if (!error) setMembers(ms => ms.map(m => m.id === id ? data : m));
    return { data, error };
  }

  async function removeMember(id) {
    const { error } = await supabase
      .from('bridal_party')
      .delete()
      .eq('id', id);
    if (!error) setMembers(ms => ms.filter(m => m.id !== id));
    return { error };
  }

  async function linkClient(memberId, clientId) {
    return updateMember(memberId, { client_id: clientId });
  }

  return { members, loading, refetch: fetch, addMember, updateMember, removeMember, linkClient };
}

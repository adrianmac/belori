import { createContext, useContext, useEffect, useState } from 'react'
import * as Sentry from '@sentry/react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [boutique, setBoutique] = useState(null)
  const [boutiques, setBoutiques] = useState([])
  const [myRole, setMyRole] = useState('front_desk')
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) loadBoutique(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (session) {
        loadBoutique(session.user.id)
      } else {
        if (event === 'SIGNED_OUT') {
          const keysToRemove = Object.keys(localStorage).filter(
            k => k.startsWith('belori_') || k === 'activeBoutiqueId'
          )
          keysToRemove.forEach(k => localStorage.removeItem(k))
        }
        setBoutique(null); setBoutiques([]); setMyRole('front_desk'); setMembers([]); setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadBoutique(userId) {
    const { data } = await supabase
      .from('boutique_members')
      .select('boutique:boutiques(*), role')
      .eq('user_id', userId)

    const validMembers = (data || []).filter(d => d.boutique)
    const all = validMembers.map(d => d.boutique)
    setMembers(validMembers)
    setBoutiques(all)

    if (all.length === 0) {
      setBoutique(null)
      setMyRole('front_desk')
      setLoading(false)
      return
    }

    // Restore last active boutique from localStorage
    const lastId = localStorage.getItem('activeBoutiqueId')
    const active = (lastId && all.find(b => b.id === lastId)) || all[0]
    setBoutique(active)

    const activeMember = validMembers.find(m => m.boutique.id === active.id)
    setMyRole(activeMember?.role || 'front_desk')
    setLoading(false)

    // Set Sentry user context so errors are tied to boutique + role
    Sentry.setUser({ id: userId })
    Sentry.setTag('boutique_id', active.id)
    Sentry.setTag('boutique_name', active.name)
    Sentry.setTag('role', activeMember?.role || 'front_desk')
  }

  function switchBoutique(id) {
    const b = boutiques.find(b => b.id === id)
    if (b) {
      setBoutique(b)
      localStorage.setItem('activeBoutiqueId', b.id)
      const m = members.find(m => m.boutique.id === id)
      setMyRole(m?.role || 'front_desk')
    }
  }

  async function signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error }
  }

  async function signUp(email, password, boutiqueName) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return { error }

    // Create boutique + member record via RPC (runs with service role)
    const { error: rpcError } = await supabase.rpc('create_boutique_for_user', {
      p_user_id: data.user.id,
      p_boutique_name: boutiqueName,
      p_owner_email: email,
    })
    return { error: rpcError }
  }

  async function reloadBoutique(userId) {
    return loadBoutique(userId || session?.user?.id)
  }

  async function signOut() {
    const keysToRemove = Object.keys(localStorage).filter(
      k => k.startsWith('belori_') || k === 'activeBoutiqueId'
    )
    keysToRemove.forEach(k => localStorage.removeItem(k))
    Sentry.setUser(null)  // Clear user context on sign-out
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ session, boutique, boutiques, myRole, loading, signIn, signUp, signOut, reloadBoutique, switchBoutique }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)

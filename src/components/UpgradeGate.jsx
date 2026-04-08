import React from 'react'
import { C } from '../lib/colors'
import { useAuth } from '../context/AuthContext'
import { PLANS } from '../hooks/useBilling'

// Map plan names to numeric tiers for comparison
const PLAN_TIERS = { free: 0, starter: 1, growth: 2, pro: 3, enterprise: 4 }

function getPlanTier(planName) {
  if (!planName) return 0
  const lower = planName.toLowerCase()
  if (lower.includes('enterprise')) return 4
  if (lower.includes('pro')) return 3
  if (lower.includes('growth')) return 2
  if (lower.includes('starter')) return 1
  return 0
}

export function useRequiresPlan(minPlan) {
  const { boutique } = useAuth()
  const currentTier = getPlanTier(boutique?.plan)
  const requiredTier = PLAN_TIERS[minPlan] || 0
  return currentTier >= requiredTier
}

export default function UpgradeGate({ minPlan = 'pro', feature = 'This feature', children, inline = false }) {
  const { boutique } = useAuth()
  const hasAccess = useRequiresPlan(minPlan)

  if (hasAccess) return children

  const planLabel = minPlan.charAt(0).toUpperCase() + minPlan.slice(1)

  if (inline) {
    return (
      <div
        style={{display:'inline-flex',alignItems:'center',gap:6,padding:'4px 10px',borderRadius:20,background:'linear-gradient(135deg,#667EEA,#764BA2)',color:'#fff',fontSize:11,fontWeight:600,cursor:'pointer'}}
        onClick={() => document.dispatchEvent(new CustomEvent('belori:show-upgrade', { detail: { feature, minPlan } }))}>
        ✨ {planLabel}
      </div>
    )
  }

  return (
    <div style={{
      position:'relative', borderRadius:12, overflow:'hidden',
      border:'2px solid transparent',
      background:`linear-gradient(${C.white},${C.white}) padding-box, linear-gradient(135deg,#667EEA,#764BA2) border-box`
    }}>
      {/* Blurred content preview */}
      <div style={{filter:'blur(3px)',pointerEvents:'none',userSelect:'none',opacity:0.4}}>
        {children}
      </div>
      {/* Upgrade overlay */}
      <div style={{
        position:'absolute',inset:0,display:'flex',flexDirection:'column',
        alignItems:'center',justifyContent:'center',gap:12,
        background:'rgba(255,255,255,0.85)',backdropFilter:'blur(2px)',
        padding:24,textAlign:'center'
      }}>
        <div style={{fontSize:28}}>✨</div>
        <div style={{fontSize:15,fontWeight:700,color:C.ink}}>{feature}</div>
        <div style={{fontSize:12,color:C.gray,maxWidth:260}}>
          Upgrade to <strong>{planLabel}</strong> to unlock this feature and get access to advanced analytics, AI tools, and more.
        </div>
        <button
          onClick={() => document.dispatchEvent(new CustomEvent('belori:show-upgrade', { detail: { feature, minPlan } }))}
          style={{
            padding:'10px 24px',borderRadius:20,border:'none',cursor:'pointer',
            background:'linear-gradient(135deg,#667EEA,#764BA2)',color:'#fff',
            fontSize:13,fontWeight:700,boxShadow:'0 4px 15px rgba(102,126,234,0.4)'
          }}>
          Upgrade to {planLabel} →
        </button>
      </div>
    </div>
  )
}

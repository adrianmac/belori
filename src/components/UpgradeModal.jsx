import React, { useState } from 'react'
import { C } from '../lib/colors'
import { useAuth } from '../context/AuthContext'

const PLAN_FEATURES = {
  pro: {
    price: '$299/mo',
    features: [
      '✨ AI task suggestions & event descriptions',
      '📊 Advanced analytics & revenue forecasting',
      '📈 Year-over-year comparisons & heatmaps',
      '🏆 Event profitability ranking',
      '🔌 QuickBooks, Mailchimp & Klaviyo sync',
      '🤖 Smart coordinator auto-assignment',
      '👗 Dress recommendation engine',
      '💰 Commission tracking',
      '📍 Multi-location support',
      'Everything in Growth +',
    ]
  },
  enterprise: {
    price: 'Custom',
    features: [
      'Everything in Pro +',
      '🏢 Unlimited locations',
      '🎨 White-label / custom branding',
      '📞 Priority phone support',
      '🔧 Custom integrations',
      '👥 Unlimited staff members',
      '📱 Native mobile app (coming soon)',
    ]
  }
}

export default function UpgradeModal({ onClose, feature, minPlan = 'pro' }) {
  const { boutique } = useAuth()
  const [selectedPlan, setSelectedPlan] = useState(minPlan === 'enterprise' ? 'enterprise' : 'pro')

  return (
    <div style={{position:'fixed',inset:0,zIndex:10000,background:'rgba(0,0,0,0.6)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
      <div style={{background:C.white,borderRadius:20,width:'100%',maxWidth:560,boxShadow:'0 24px 80px rgba(0,0,0,0.3)',overflow:'hidden'}}>
        {/* Header */}
        <div style={{background:'linear-gradient(135deg,#667EEA,#764BA2)',padding:'24px 28px',color:'#fff'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
            <div>
              <div style={{fontSize:22,fontWeight:800,marginBottom:4}}>✨ Unlock {feature}</div>
              <div style={{fontSize:13,opacity:0.85}}>Upgrade your plan to access this and many more features</div>
            </div>
            <button onClick={onClose} style={{background:'rgba(255,255,255,0.2)',border:'none',color:'#fff',width:32,height:32,borderRadius:8,cursor:'pointer',fontSize:18,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}} aria-label="Close">×</button>
          </div>
        </div>

        {/* Plan toggle */}
        <div style={{padding:'20px 28px 0'}}>
          <div style={{display:'flex',gap:8,marginBottom:20}}>
            {['pro','enterprise'].map(p => (
              <button key={p} onClick={() => setSelectedPlan(p)}
                style={{flex:1,padding:'10px',borderRadius:10,border:`2px solid ${selectedPlan===p?'#667EEA':C.border}`,background:selectedPlan===p?'#EEF2FF':C.white,color:selectedPlan===p?'#4C1D95':C.ink,fontWeight:600,fontSize:13,cursor:'pointer'}}>
                {p === 'pro' ? '⚡ Pro' : '🏢 Enterprise'}
                <div style={{fontSize:12,fontWeight:400,marginTop:2}}>{PLAN_FEATURES[p].price}</div>
              </button>
            ))}
          </div>

          {/* Features list */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px 16px',marginBottom:20}}>
            {PLAN_FEATURES[selectedPlan].features.map((f, i) => (
              <div key={i} style={{fontSize:12,color:C.ink,display:'flex',alignItems:'center',gap:6}}>
                <span style={{color:'#7C3AED',fontWeight:700,flexShrink:0}}>✓</span>{f}
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div style={{padding:'0 28px 24px',display:'flex',gap:10}}>
          <button
            onClick={() => { window.open((import.meta.env.VITE_APP_URL || 'https://belori.app') + '/?upgrade=' + selectedPlan, '_blank'); onClose() }}
            style={{flex:1,padding:'12px',background:'linear-gradient(135deg,#667EEA,#764BA2)',color:'#fff',border:'none',borderRadius:12,fontSize:14,fontWeight:700,cursor:'pointer'}}>
            Upgrade to {selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)} →
          </button>
          <button onClick={onClose} style={{padding:'12px 20px',background:C.grayBg,color:C.gray,border:'none',borderRadius:12,fontSize:14,cursor:'pointer'}}>
            Later
          </button>
        </div>

        <div style={{textAlign:'center',fontSize:11,color:C.gray,paddingBottom:16}}>
          🔒 Cancel anytime · 14-day free trial · No credit card required
        </div>
      </div>
    </div>
  )
}

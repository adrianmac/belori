import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400;1,500&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400&display=swap');

.hp-root *, .hp-root *::before, .hp-root *::after { box-sizing: border-box; margin: 0; padding: 0; }
.hp-root { font-family: 'DM Sans', sans-serif; font-weight: 300; background: #FBF7F5; color: #1C1012; overflow-x: hidden; }

:root {
  --rosa: #C9697A; --rh: #B85868; --rp: #FDF5F6; --rl: #E8B4BB;
  --ink: #1C1012; --inkl: #2D1A1C; --gold: #D4AF37; --ivory: #F8F4F0;
  --canvas: #FBF7F5; --gray: #6B5A5C; --gl: #9C8A8C; --border: rgba(201,105,122,.15);
}

.hp-root .serif { font-family: 'Playfair Display', serif; }
.hp-root .mono  { font-family: 'DM Mono', monospace; }

@keyframes hp-fadeUp  { from { opacity:0; transform:translateY(28px); } to { opacity:1; transform:translateY(0); } }
@keyframes hp-fadeIn  { from { opacity:0; } to { opacity:1; } }
@keyframes hp-float   { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-10px); } }
@keyframes hp-pulseRing { 0% { transform:scale(1); opacity:.6; } 100% { transform:scale(1.6); opacity:0; } }
@keyframes hp-scrollX { 0% { transform:translateX(0); } 100% { transform:translateX(-50%); } }

.hp-root .reveal { opacity:0; transform:translateY(24px); transition:opacity .7s ease, transform .7s ease; }
.hp-root .reveal.visible { opacity:1; transform:none; }

/* NAV */
.hp-nav {
  position:fixed; top:0; left:0; right:0; z-index:100;
  padding:18px 48px;
  display:flex; align-items:center; justify-content:space-between;
  transition:all .3s ease;
}
.hp-nav.scrolled {
  background:rgba(251,247,245,.92); backdrop-filter:blur(16px);
  border-bottom:1px solid var(--border); padding:14px 48px;
}
.hp-nav-logo { display:flex; align-items:center; gap:10px; text-decoration:none; cursor:pointer; background:none; border:none; }
.hp-nav-mark { width:34px; height:34px; background:var(--rosa); border-radius:8px; display:flex; align-items:center; justify-content:center; }
.hp-nav-mark svg { width:18px; height:18px; }
.hp-wordmark { font-family:'Playfair Display',serif; font-size:20px; font-weight:500; color:var(--ink); letter-spacing:-.01em; }
.hp-nav-links { display:flex; align-items:center; gap:32px; list-style:none; }
.hp-nav-links a, .hp-nav-links button {
  font-size:13px; font-weight:400; color:var(--gray); text-decoration:none;
  letter-spacing:.01em; transition:color .2s; background:none; border:none; cursor:pointer;
  font-family:inherit;
}
.hp-nav-links a:hover, .hp-nav-links button:hover { color:var(--rosa); }
.hp-nav-cta {
  background:var(--ink); color:#fff !important; padding:9px 22px; border-radius:8px;
  font-weight:500 !important; letter-spacing:.02em !important;
  transition:background .2s, transform .15s !important;
}
.hp-nav-cta:hover { background:var(--rosa) !important; transform:translateY(-1px); }

/* HERO */
.hp-hero {
  min-height:100vh; display:flex; flex-direction:column; align-items:center;
  justify-content:center; text-align:center; padding:120px 24px 80px;
  position:relative; overflow:hidden;
}
.hp-hero-bg { position:absolute; inset:0; z-index:0; }
.hp-petal { position:absolute; border-radius:50% 50% 50% 0; opacity:.06; }
.hp-p1 { width:600px; height:600px; background:var(--rosa); top:-150px; right:-200px; transform:rotate(30deg); }
.hp-p2 { width:400px; height:400px; background:var(--gold); bottom:-100px; left:-100px; transform:rotate(-20deg); opacity:.04; }
.hp-p3 { width:300px; height:300px; background:var(--rosa); top:30%; left:5%; transform:rotate(15deg); opacity:.04; }
.hp-hero-grid {
  position:absolute; inset:0;
  background-image: linear-gradient(rgba(201,105,122,.04) 1px, transparent 1px), linear-gradient(90deg, rgba(201,105,122,.04) 1px, transparent 1px);
  background-size:48px 48px;
  mask-image:radial-gradient(ellipse 70% 60% at 50% 50%, black 40%, transparent 100%);
  -webkit-mask-image:radial-gradient(ellipse 70% 60% at 50% 50%, black 40%, transparent 100%);
}
.hp-hero-content { position:relative; z-index:1; max-width:820px; }
.hp-badge {
  display:inline-flex; align-items:center; gap:7px; background:var(--rp);
  border:1px solid var(--rl); border-radius:99px; padding:6px 16px 6px 8px;
  font-size:12px; font-weight:500; color:var(--rosa); margin-bottom:32px;
  animation:hp-fadeIn 1s ease both;
}
.hp-badge-dot {
  width:20px; height:20px; border-radius:50%; background:var(--rosa);
  display:flex; align-items:center; justify-content:center; position:relative;
}
.hp-badge-dot::after {
  content:''; position:absolute; inset:-5px; border-radius:50%;
  border:1.5px solid var(--rosa); animation:hp-pulseRing 1.8s ease-out infinite;
}
.hp-h1 {
  font-family:'Playfair Display',serif; font-size:clamp(42px,7vw,80px); font-weight:500;
  line-height:1.08; letter-spacing:-.02em; color:var(--ink); margin-bottom:24px;
  animation:hp-fadeUp .9s ease .15s both;
}
.hp-h1 em { font-style:italic; color:var(--rosa); }
.hp-sub {
  font-size:clamp(16px,2.5vw,20px); font-weight:300; color:var(--gray); line-height:1.6;
  max-width:560px; margin:0 auto 40px; animation:hp-fadeUp .9s ease .3s both;
}
.hp-ctas { display:flex; align-items:center; justify-content:center; gap:14px; flex-wrap:wrap; animation:hp-fadeUp .9s ease .45s both; }
.hp-btn-primary {
  background:var(--rosa); color:#fff; padding:14px 32px; border-radius:10px;
  font-size:14px; font-weight:500; text-decoration:none; letter-spacing:.01em;
  box-shadow:0 4px 20px rgba(201,105,122,.4), 0 1px 4px rgba(201,105,122,.2);
  transition:all .2s ease; display:inline-flex; align-items:center; gap:8px;
  border:none; cursor:pointer; font-family:inherit;
}
.hp-btn-primary:hover { background:var(--rh); transform:translateY(-2px); box-shadow:0 8px 28px rgba(201,105,122,.4); }
.hp-btn-secondary {
  background:transparent; color:var(--ink); padding:13px 28px; border-radius:10px;
  font-size:14px; font-weight:400; text-decoration:none; border:1.5px solid rgba(28,16,18,.2);
  transition:all .2s ease; display:inline-flex; align-items:center; gap:7px;
  cursor:pointer; font-family:inherit;
}
.hp-btn-secondary:hover { border-color:var(--rosa); color:var(--rosa); transform:translateY(-2px); }
.hp-proof { margin-top:56px; animation:hp-fadeUp .9s ease .6s both; }
.hp-proof-text { font-size:12px; color:var(--gl); letter-spacing:.05em; text-transform:uppercase; margin-bottom:12px; }
.hp-proof-avatars { display:flex; align-items:center; justify-content:center; }
.hp-proof-av {
  width:36px; height:36px; border-radius:50%; border:2.5px solid var(--canvas); margin-left:-8px;
  font-size:11px; font-weight:500; display:flex; align-items:center; justify-content:center;
}
.hp-proof-av:first-child { margin-left:0; }
.hp-proof-count { margin-left:12px; font-size:13px; font-weight:500; color:var(--ink); }
.hp-proof-count span { color:var(--rosa); }

/* MARQUEE */
.hp-marquee { border-top:1px solid var(--border); border-bottom:1px solid var(--border); background:var(--ivory); padding:16px 0; overflow:hidden; }
.hp-marquee-inner { display:flex; gap:0; animation:hp-scrollX 28s linear infinite; width:max-content; }
.hp-marquee-item {
  flex-shrink:0; padding:0 36px; font-size:11px; font-weight:500; color:var(--gl);
  letter-spacing:.08em; text-transform:uppercase; display:flex; align-items:center; gap:10px; white-space:nowrap;
}
.hp-marquee-sep { color:var(--rl); font-size:16px; }

/* SECTIONS */
.hp-section { padding:100px 24px; }
.hp-section-inner { max-width:1100px; margin:0 auto; }
.hp-section-label {
  font-size:11px; font-weight:500; color:var(--rosa); letter-spacing:.1em; text-transform:uppercase;
  display:flex; align-items:center; gap:8px; margin-bottom:16px;
}
.hp-section-label::before { content:''; width:24px; height:1px; background:var(--rosa); display:inline-block; }
.hp-section-title {
  font-family:'Playfair Display',serif; font-size:clamp(32px,4.5vw,52px); font-weight:500;
  line-height:1.1; letter-spacing:-.02em; color:var(--ink); margin-bottom:18px;
}
.hp-section-title em { font-style:italic; color:var(--rosa); }
.hp-section-sub { font-size:17px; font-weight:300; color:var(--gray); line-height:1.65; max-width:520px; }

/* STATS */
.hp-stats { background:#fff; border-top:1px solid var(--border); border-bottom:1px solid var(--border); }
.hp-stats-grid { display:grid; grid-template-columns:repeat(4,1fr); }
.hp-stat { padding:40px 32px; border-right:1px solid var(--border); text-align:center; }
.hp-stat:last-child { border-right:none; }
.hp-stat-num { font-family:'Playfair Display',serif; font-size:48px; font-weight:400; color:var(--ink); line-height:1; margin-bottom:6px; }
.hp-stat-num span { color:var(--rosa); }
.hp-stat-lbl { font-size:13px; font-weight:300; color:var(--gl); letter-spacing:.01em; }

/* FEATURES */
.hp-features { background:var(--ivory); padding:100px 24px; }
.hp-features-intro { max-width:600px; margin-bottom:64px; }
.hp-feat-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; }
.hp-feat-card {
  background:#fff; border:1px solid rgba(201,105,122,.12); border-radius:16px;
  padding:28px; transition:all .25s ease; position:relative; overflow:hidden;
}
.hp-feat-card::before {
  content:''; position:absolute; top:0; left:0; right:0; height:3px;
  background:linear-gradient(90deg,var(--rosa),var(--gold)); transform:scaleX(0);
  transform-origin:left; transition:transform .3s ease;
}
.hp-feat-card:hover { transform:translateY(-4px); box-shadow:0 12px 40px rgba(201,105,122,.12); border-color:rgba(201,105,122,.25); }
.hp-feat-card:hover::before { transform:scaleX(1); }
.hp-feat-icon { width:48px; height:48px; border-radius:12px; background:var(--rp); display:flex; align-items:center; justify-content:center; font-size:22px; margin-bottom:18px; transition:transform .25s ease; }
.hp-feat-card:hover .hp-feat-icon { transform:scale(1.08); }
.hp-feat-title { font-family:'Playfair Display',serif; font-size:19px; font-weight:500; color:var(--ink); margin-bottom:10px; letter-spacing:-.01em; }
.hp-feat-desc { font-size:14px; font-weight:300; color:var(--gray); line-height:1.6; margin-bottom:18px; }
.hp-feat-bullets { list-style:none; display:flex; flex-direction:column; gap:6px; }
.hp-feat-bullets li { font-size:12px; color:var(--gl); display:flex; align-items:center; gap:7px; }
.hp-feat-bullets li::before { content:''; width:5px; height:5px; border-radius:50%; background:var(--rl); flex-shrink:0; }
.hp-feat-card.hp-featured { grid-column:span 2; background:var(--ink); border-color:transparent; padding:36px; }
.hp-feat-card.hp-featured .hp-feat-icon { background:rgba(201,105,122,.25); }
.hp-feat-card.hp-featured .hp-feat-title { color:#fff; }
.hp-feat-card.hp-featured .hp-feat-desc { color:rgba(255,255,255,.6); }
.hp-feat-card.hp-featured .hp-feat-bullets li { color:rgba(255,255,255,.5); }
.hp-feat-card.hp-featured .hp-feat-bullets li::before { background:var(--rosa); }
.hp-feat-card.hp-featured::before { background:linear-gradient(90deg,var(--rosa),var(--gold)); }

/* HOW IT WORKS */
.hp-how-grid { display:grid; grid-template-columns:1fr 1fr; gap:80px; align-items:center; }
.hp-how-steps { display:flex; flex-direction:column; }
.hp-how-step { display:flex; gap:20px; padding:24px 0; border-bottom:1px solid var(--border); cursor:pointer; transition:all .2s; }
.hp-how-step:first-child { padding-top:0; }
.hp-how-step:last-child { border-bottom:none; }
.hp-how-step:hover .hp-step-title { color:var(--rosa); }
.hp-step-num {
  width:36px; height:36px; border-radius:50%; border:1.5px solid var(--rl); color:var(--rosa);
  font-family:'DM Mono',monospace; font-size:12px; font-weight:500; display:flex;
  align-items:center; justify-content:center; flex-shrink:0; margin-top:2px; transition:all .2s;
}
.hp-how-step:hover .hp-step-num { background:var(--rosa); color:#fff; border-color:var(--rosa); }
.hp-step-title { font-family:'Playfair Display',serif; font-size:18px; font-weight:500; color:var(--ink); margin-bottom:6px; transition:color .2s; }
.hp-step-desc { font-size:14px; font-weight:300; color:var(--gray); line-height:1.6; }
.hp-mock-panel {
  background:#fff; border:1px solid var(--border); border-radius:20px; overflow:hidden;
  box-shadow:0 24px 80px rgba(201,105,122,.12), 0 4px 16px rgba(0,0,0,.06);
  animation:hp-float 5s ease-in-out infinite;
}
.hp-mock-bar { background:var(--ink); padding:12px 16px; display:flex; align-items:center; gap:8px; }
.hp-mock-dot { width:10px; height:10px; border-radius:50%; }
.hp-mock-url {
  flex:1; background:rgba(255,255,255,.1); border-radius:5px; height:22px;
  display:flex; align-items:center; padding:0 10px; font-size:10px; font-family:'DM Mono',monospace; color:rgba(255,255,255,.4);
}
.hp-mock-body { padding:16px; }
.hp-mock-event-row { display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:9px; margin-bottom:6px; transition:background .2s; }
.hp-mock-event-row:hover { background:var(--rp); }
.hp-mock-av { width:32px; height:32px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:500; flex-shrink:0; }
.hp-mock-name { font-size:12px; font-weight:500; color:var(--ink); }
.hp-mock-meta { font-size:10px; color:var(--gl); margin-top:1px; }
.hp-mock-bdg { margin-left:auto; font-size:9px; font-weight:500; padding:2px 8px; border-radius:99px; }
.hp-mock-prog-wrap { margin-top:12px; }
.hp-mock-prog-lbl { display:flex; justify-content:space-between; font-size:10px; color:var(--gl); margin-bottom:4px; }
.hp-mock-prog { height:5px; background:#F0EDE9; border-radius:3px; overflow:hidden; }
.hp-mock-prog-fill { height:100%; border-radius:3px; background:linear-gradient(90deg,var(--rosa),var(--gold)); }

/* MODULES */
.hp-modules { background:var(--ink); overflow:hidden; position:relative; padding:100px 24px; }
.hp-modules .hp-section-label { color:var(--rl); }
.hp-modules .hp-section-label::before { background:var(--rl); }
.hp-modules .hp-section-title { color:#fff; }
.hp-modules .hp-section-sub { color:rgba(255,255,255,.5); }
.hp-modules-grid { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-top:56px; }
.hp-mod-card { background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.1); border-radius:14px; padding:20px; transition:all .25s; cursor:pointer; }
.hp-mod-card:hover { background:rgba(201,105,122,.15); border-color:rgba(201,105,122,.35); transform:translateY(-3px); }
.hp-mod-icon { font-size:24px; margin-bottom:10px; }
.hp-mod-name { font-size:13px; font-weight:500; color:#fff; margin-bottom:4px; }
.hp-mod-desc { font-size:11px; color:rgba(255,255,255,.4); line-height:1.5; }
.hp-mod-card.hp-core { border-color:rgba(201,105,122,.3); background:rgba(201,105,122,.1); }
.hp-mod-card.hp-core .hp-mod-name { color:var(--rl); }
.hp-mod-badge { display:inline-block; font-size:9px; font-weight:500; padding:2px 7px; border-radius:99px; margin-bottom:8px; }
.hp-badge-core { background:rgba(201,105,122,.25); color:var(--rl); }
.hp-badge-growth { background:rgba(212,175,55,.2); color:var(--gold); }
.hp-badge-pro { background:rgba(212,175,55,.3); color:var(--gold); }
.hp-modules .hp-bg-dec { position:absolute; border-radius:50%; filter:blur(100px); opacity:.08; pointer-events:none; }
.hp-bd1 { width:600px; height:600px; background:var(--rosa); top:-200px; right:-200px; }
.hp-bd2 { width:400px; height:400px; background:var(--gold); bottom:-100px; left:100px; }

/* TESTIMONIALS */
.hp-testi-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; margin-top:56px; }
.hp-testi-card { background:#fff; border:1px solid var(--border); border-radius:16px; padding:28px; position:relative; transition:all .25s; }
.hp-testi-card:hover { transform:translateY(-3px); box-shadow:0 12px 40px rgba(201,105,122,.1); }
.hp-testi-quote { font-family:'Playfair Display',serif; font-size:38px; color:var(--rl); line-height:1; margin-bottom:14px; }
.hp-testi-text { font-size:14px; font-weight:300; color:var(--gray); line-height:1.7; margin-bottom:22px; font-style:italic; }
.hp-testi-author { display:flex; align-items:center; gap:10px; }
.hp-testi-av { width:38px; height:38px; border-radius:50%; background:var(--rp); display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:500; color:var(--rosa); }
.hp-testi-name { font-size:13px; font-weight:500; color:var(--ink); }
.hp-testi-role { font-size:11px; color:var(--gl); margin-top:1px; }
.hp-testi-stars { color:var(--gold); font-size:13px; margin-bottom:14px; letter-spacing:2px; }

/* PRICING */
.hp-pricing-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:20px; margin-top:56px; }
.hp-price-card { background:#fff; border:1.5px solid var(--border); border-radius:20px; padding:36px 32px; position:relative; transition:all .25s; }
.hp-price-card:hover { transform:translateY(-4px); box-shadow:0 16px 48px rgba(201,105,122,.1); }
.hp-price-card.hp-popular { border-color:var(--rosa); background:var(--ink); }
.hp-popular-badge {
  position:absolute; top:-13px; left:50%; transform:translateX(-50%);
  background:var(--rosa); color:#fff; font-size:11px; font-weight:500;
  padding:4px 16px; border-radius:99px; letter-spacing:.04em; white-space:nowrap;
}
.hp-price-tier { font-size:12px; font-weight:500; letter-spacing:.08em; text-transform:uppercase; color:var(--rosa); margin-bottom:16px; }
.hp-price-card.hp-popular .hp-price-tier { color:var(--rl); }
.hp-price-amount { display:flex; align-items:flex-start; gap:3px; margin-bottom:6px; }
.hp-price-dollar { font-size:20px; font-weight:500; color:var(--gray); padding-top:8px; }
.hp-price-num { font-family:'Playfair Display',serif; font-size:56px; font-weight:400; color:var(--ink); line-height:1; }
.hp-price-card.hp-popular .hp-price-num { color:#fff; }
.hp-price-card.hp-popular .hp-price-dollar { color:rgba(255,255,255,.5); }
.hp-price-period { font-size:13px; color:var(--gl); padding-top:28px; }
.hp-price-desc { font-size:14px; color:var(--gray); margin-bottom:28px; line-height:1.5; font-weight:300; }
.hp-price-card.hp-popular .hp-price-desc { color:rgba(255,255,255,.5); }
.hp-price-divider { height:1px; background:var(--border); margin-bottom:24px; }
.hp-price-card.hp-popular .hp-price-divider { background:rgba(255,255,255,.1); }
.hp-price-features { list-style:none; display:flex; flex-direction:column; gap:12px; margin-bottom:32px; }
.hp-price-features li { font-size:13px; font-weight:300; color:var(--gray); display:flex; align-items:flex-start; gap:8px; }
.hp-price-card.hp-popular .hp-price-features li { color:rgba(255,255,255,.7); }
.hp-check { color:#15803D; font-size:14px; margin-top:1px; flex-shrink:0; }
.hp-price-card.hp-popular .hp-check { color:var(--rosa); }
.hp-price-btn { display:block; width:100%; padding:13px; border-radius:10px; font-size:14px; font-weight:500; text-align:center; text-decoration:none; transition:all .2s; cursor:pointer; font-family:inherit; }
.hp-price-btn-outline { background:transparent; border:1.5px solid rgba(201,105,122,.25); color:var(--rosa); }
.hp-price-btn-outline:hover { background:var(--rp); border-color:var(--rosa); }
.hp-price-btn-fill { background:var(--rosa); color:#fff; box-shadow:0 4px 16px rgba(201,105,122,.35); border:none; }
.hp-price-btn-fill:hover { background:var(--rh); transform:translateY(-1px); }

/* CTA SECTION */
.hp-cta-section {
  background:var(--rosa); text-align:center; padding:100px 24px; position:relative; overflow:hidden;
}
.hp-cta-section::before {
  content:''; position:absolute; inset:0;
  background-image: radial-gradient(circle at 20% 50%, rgba(255,255,255,.08) 0%, transparent 50%),
    radial-gradient(circle at 80% 50%, rgba(255,255,255,.06) 0%, transparent 50%);
}
.hp-cta-section .hp-section-title { color:#fff; }
.hp-cta-section .hp-section-title em { color:rgba(255,255,255,.7); font-style:italic; }
.hp-cta-section .hp-section-sub { color:rgba(255,255,255,.7); margin:0 auto 40px; }
.hp-btn-white {
  background:#fff; color:var(--rosa); padding:15px 36px; border-radius:10px;
  font-size:15px; font-weight:500; text-decoration:none; display:inline-flex; align-items:center;
  gap:8px; box-shadow:0 4px 20px rgba(0,0,0,.15); transition:all .2s; position:relative;
  z-index:1; border:none; cursor:pointer; font-family:inherit;
}
.hp-btn-white:hover { transform:translateY(-3px); box-shadow:0 10px 32px rgba(0,0,0,.2); }
.hp-cta-note { font-size:12px; color:rgba(255,255,255,.6); margin-top:16px; position:relative; z-index:1; }

/* FOOTER */
.hp-footer { background:var(--ink); padding:64px 24px 32px; }
.hp-footer-inner { max-width:1100px; margin:0 auto; }
.hp-footer-top { display:grid; grid-template-columns:1.5fr repeat(3,1fr); gap:48px; margin-bottom:48px; }
.hp-footer-brand-text { font-family:'Playfair Display',serif; font-size:24px; color:#fff; margin:12px 0 10px; }
.hp-footer-brand-sub { font-size:13px; color:rgba(255,255,255,.4); line-height:1.6; font-weight:300; }
.hp-footer-col-title { font-size:11px; font-weight:500; color:rgba(255,255,255,.4); letter-spacing:.08em; text-transform:uppercase; margin-bottom:16px; }
.hp-footer-links { list-style:none; display:flex; flex-direction:column; gap:10px; }
.hp-footer-links a { font-size:13px; color:rgba(255,255,255,.5); text-decoration:none; font-weight:300; transition:color .2s; }
.hp-footer-links a:hover { color:var(--rl); }
.hp-footer-divider { height:1px; background:rgba(255,255,255,.08); margin-bottom:24px; }
.hp-footer-bottom { display:flex; align-items:center; justify-content:space-between; font-size:12px; color:rgba(255,255,255,.3); }
.hp-footer-tagline { font-family:'Playfair Display',serif; font-style:italic; color:rgba(201,105,122,.6); font-size:14px; }

/* HAMBURGER */
.hp-hamburger {
  display:none; flex-direction:column; justify-content:center; gap:5px;
  background:none; border:none; cursor:pointer; padding:6px; z-index:200;
}
.hp-hamburger span { display:block; width:22px; height:2px; background:var(--ink); border-radius:2px; transition:all .25s ease; }
.hp-hamburger.open span:nth-child(1) { transform:translateY(7px) rotate(45deg); }
.hp-hamburger.open span:nth-child(2) { opacity:0; }
.hp-hamburger.open span:nth-child(3) { transform:translateY(-7px) rotate(-45deg); }
.hp-mobile-menu {
  display:none; position:fixed; top:0; left:0; right:0; bottom:0; z-index:150;
  background:rgba(251,247,245,.97); backdrop-filter:blur(16px);
  flex-direction:column; align-items:center; justify-content:center; gap:28px;
}
.hp-mobile-menu.open { display:flex; }
.hp-mobile-menu a, .hp-mobile-menu button {
  font-family:'DM Sans',sans-serif; font-size:22px; font-weight:400; color:var(--ink);
  text-decoration:none; background:none; border:none; cursor:pointer; transition:color .2s;
}
.hp-mobile-menu a:hover, .hp-mobile-menu button:hover { color:var(--rosa); }
.hp-mobile-menu .hp-mob-cta {
  background:var(--rosa); color:#fff !important; padding:13px 36px;
  border-radius:10px; font-size:16px; font-weight:500;
}
.hp-mobile-menu .hp-mob-cta:hover { background:var(--rh) !important; }

/* RESPONSIVE */
@media (max-width:900px) {
  .hp-feat-grid { grid-template-columns:1fr 1fr; }
  .hp-feat-card.hp-featured { grid-column:span 2; }
  .hp-how-grid { grid-template-columns:1fr; }
  .hp-mock-panel { display:none; }
  .hp-modules-grid { grid-template-columns:repeat(2,1fr); }
  .hp-testi-grid { grid-template-columns:1fr; }
  .hp-pricing-grid { grid-template-columns:1fr; }
  .hp-footer-top { grid-template-columns:1fr 1fr; }
  .hp-stats-grid { grid-template-columns:repeat(2,1fr); }
  .hp-nav-links { display:none; }
  .hp-hamburger { display:flex; }
}
@media (max-width:600px) {
  .hp-feat-grid { grid-template-columns:1fr; }
  .hp-feat-card.hp-featured { grid-column:span 1; }
  .hp-modules-grid { grid-template-columns:repeat(2,1fr); }
  .hp-nav { padding:14px 20px; }
  .hp-section { padding:70px 20px; }
  .hp-features { padding:70px 20px; }
  .hp-modules { padding:70px 20px; }
}
`

export default function HomePage() {
  const navRef = useRef(null)
  const navigate = useNavigate()
  const { session, boutique, loading } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  // Redirect authenticated users into the app
  useEffect(() => {
    if (!loading && session) {
      navigate(boutique ? '/dashboard' : '/onboarding', { replace: true })
    }
  }, [loading, session, boutique])

  useEffect(() => {
    const style = document.createElement('style')
    style.id = 'hp-styles'
    style.textContent = CSS
    document.head.appendChild(style)

    // Sticky nav
    const handleScroll = () => {
      navRef.current?.classList.toggle('scrolled', window.scrollY > 40)
    }
    window.addEventListener('scroll', handleScroll)

    // Scroll reveal
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((e, i) => {
        if (e.isIntersecting) {
          setTimeout(() => e.target.classList.add('visible'), i * 60)
          observer.unobserve(e.target)
        }
      })
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' })
    document.querySelectorAll('.hp-root .reveal').forEach(el => observer.observe(el))

    // Count-up for stats
    const countEls = document.querySelectorAll('.hp-stat-num')
    const countObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return
        const el = entry.target
        const span = el.querySelector('span')
        if (!span) return
        const raw = span.textContent.replace(/[^0-9.]/g, '')
        const isFloat = raw.includes('.')
        const final = parseFloat(raw)
        const suffix = span.textContent.replace(/[0-9.]/g, '')
        let start = 0
        const duration = 1800
        const step = ts => {
          if (!start) start = ts
          const progress = Math.min((ts - start) / duration, 1)
          const eased = 1 - Math.pow(1 - progress, 3)
          const current = eased * final
          span.textContent = (isFloat ? current.toFixed(1) : Math.floor(current)) + suffix
          if (progress < 1) requestAnimationFrame(step)
        }
        requestAnimationFrame(step)
        countObserver.unobserve(el)
      })
    }, { threshold: 0.5 })
    countEls.forEach(el => countObserver.observe(el))

    return () => {
      document.getElementById('hp-styles')?.remove()
      window.removeEventListener('scroll', handleScroll)
      observer.disconnect()
      countObserver.disconnect()
    }
  }, [])

  const scrollTo = (id) => (e) => {
    e.preventDefault()
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const ArrowRight = () => (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )

  return (
    <div className="hp-root">
      {/* MOBILE MENU */}
      <div className={`hp-mobile-menu${mobileMenuOpen ? ' open' : ''}`}>
        <a href="#hp-features" onClick={(e) => { scrollTo('hp-features')(e); setMobileMenuOpen(false) }}>Features</a>
        <a href="#hp-modules" onClick={(e) => { scrollTo('hp-modules')(e); setMobileMenuOpen(false) }}>Modules</a>
        <a href="#hp-how" onClick={(e) => { scrollTo('hp-how')(e); setMobileMenuOpen(false) }}>How it works</a>
        <a href="#hp-pricing" onClick={(e) => { scrollTo('hp-pricing')(e); setMobileMenuOpen(false) }}>Pricing</a>
        <button onClick={() => { navigate('/login'); setMobileMenuOpen(false) }}>Sign in</button>
        <button className="hp-mob-cta" onClick={() => { navigate('/signup'); setMobileMenuOpen(false) }}>Start free trial</button>
      </div>

      {/* NAV */}
      <nav className="hp-nav" ref={navRef} id="hp-nav">
        <button className="hp-nav-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
          <div className="hp-nav-mark">
            <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M7 25V7l18 18V7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <span className="hp-wordmark">Belori</span>
        </button>
        <ul className="hp-nav-links">
          <li><a href="#hp-features" onClick={scrollTo('hp-features')}>Features</a></li>
          <li><a href="#hp-modules" onClick={scrollTo('hp-modules')}>Modules</a></li>
          <li><a href="#hp-how" onClick={scrollTo('hp-how')}>How it works</a></li>
          <li><a href="#hp-pricing" onClick={scrollTo('hp-pricing')}>Pricing</a></li>
          <li><button onClick={() => navigate('/login')} style={{fontSize:13,fontWeight:400,color:'#6B5A5C',background:'none',border:'none',cursor:'pointer',fontFamily:'inherit',letterSpacing:'.01em',transition:'color .2s'}} onMouseEnter={e=>e.target.style.color='#C9697A'} onMouseLeave={e=>e.target.style.color='#6B5A5C'}>Sign in</button></li>
          <li><button className="hp-nav-cta" onClick={() => navigate('/signup')}>Start free trial</button></li>
        </ul>
        <button className={`hp-hamburger${mobileMenuOpen ? ' open' : ''}`} onClick={() => setMobileMenuOpen(v => !v)} aria-label="Menu">
          <span /><span /><span />
        </button>
      </nav>

      {/* HERO */}
      <section className="hp-hero" id="hp-home">
        <div className="hp-hero-bg">
          <div className="hp-hero-grid" />
          <div className="hp-petal hp-p1" />
          <div className="hp-petal hp-p2" />
          <div className="hp-petal hp-p3" />
        </div>
        <div className="hp-hero-content">
          <div className="hp-badge">
            <div className="hp-badge-dot">
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <path d="M2 5l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </div>
            Now with wedding planning + hotel tracking
          </div>
          <h1 className="hp-h1 serif">
            Run your boutique.<br/>
            <em>Beautifully.</em>
          </h1>
          <p className="hp-sub">
            The all-in-one platform for bridal boutiques — events, dress rentals, alterations,
            wedding planning, and your POS register. Everything in one place.
          </p>
          <div className="hp-ctas">
            <button className="hp-btn-primary" onClick={() => navigate('/signup')}>
              Start your free trial <ArrowRight />
            </button>
            <button className="hp-btn-secondary" onClick={scrollTo('hp-features')}>
              See all features
            </button>
          </div>
          <div className="hp-proof">
            <div className="hp-proof-text">Trusted by boutiques across the US</div>
            <div className="hp-proof-avatars">
              <div className="hp-proof-av" style={{background:'#FDF5F6',color:'#C9697A'}}>IM</div>
              <div className="hp-proof-av" style={{background:'#EDE9FE',color:'#7C3AED'}}>SR</div>
              <div className="hp-proof-av" style={{background:'#DCFCE7',color:'#15803D'}}>MG</div>
              <div className="hp-proof-av" style={{background:'#DBEAFE',color:'#1D4ED8'}}>LC</div>
              <div className="hp-proof-av" style={{background:'#FEF3C7',color:'#B45309'}}>AT</div>
              <div className="hp-proof-av" style={{background:'#1C1012',color:'#D4AF37'}}>+</div>
              <span className="hp-proof-count"><span>200+</span> boutiques</span>
            </div>
          </div>
        </div>
      </section>

      {/* MARQUEE */}
      <div className="hp-marquee">
        <div className="hp-marquee-inner">
          {['Events','Dress Rental','Alterations','POS Register','Wedding Planning','Guest Management',
            'Hotel Tracking','Client CRM','Budget Tracking','Vendor Management','SMS Automations',
            'Seating Charts','Run of Show',
            'Events','Dress Rental','Alterations','POS Register','Wedding Planning','Guest Management',
            'Hotel Tracking','Client CRM','Budget Tracking','Vendor Management','SMS Automations',
            'Seating Charts','Run of Show'
          ].map((item, i) => (
            <div className="hp-marquee-item" key={i}>
              {item} <span className="hp-marquee-sep">✦</span>
            </div>
          ))}
        </div>
      </div>

      {/* STATS */}
      <div className="hp-stats">
        <div style={{maxWidth:'100%'}}>
          <div className="hp-stats-grid">
            {[
              { num: '200', suffix: '+', label: 'Boutiques running on Belori' },
              { num: '14k', suffix: '+', label: 'Events managed this year' },
              { num: '32', suffix: '',  label: 'Feature modules available' },
              { num: '98', suffix: '%', label: 'Boutique owner satisfaction' },
            ].map(({ num, suffix, label }) => (
              <div className="hp-stat reveal" key={label}>
                <div className="hp-stat-num"><span>{num}</span>{suffix}</div>
                <div className="hp-stat-lbl">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FEATURES */}
      <section className="hp-features" id="hp-features">
        <div className="hp-section-inner">
          <div className="hp-features-intro reveal">
            <div className="hp-section-label">Features</div>
            <h2 className="hp-section-title">Everything your boutique needs, <em>nothing it doesn't</em></h2>
            <p className="hp-section-sub">Built by talking to real boutique owners. Every feature solves a real problem — from managing dress rentals to coordinating a 200-person wedding weekend.</p>
          </div>
          <div className="hp-feat-grid">

            <div className="hp-feat-card hp-featured reveal">
              <div className="hp-feat-icon">📅</div>
              <div className="hp-feat-title">Event management</div>
              <div className="hp-feat-desc">Your command center for every wedding, quinceañera, and celebration. Milestones, tasks, payment tracking, and urgency detection — all in one place.</div>
              <ul className="hp-feat-bullets">
                <li>Payment milestones with automated overdue alerts</li>
                <li>Urgency engine flags events needing attention</li>
                <li>Coordinator assignment and staff notes timeline</li>
                <li>Linked dress rentals, alterations, and decoration inventory</li>
              </ul>
            </div>

            <div className="hp-feat-card reveal">
              <div className="hp-feat-icon">💍</div>
              <div className="hp-feat-title">Wedding planner</div>
              <div className="hp-feat-desc">A full 12-section planning workbook attached to every wedding event — from budget to run of show.</div>
              <ul className="hp-feat-bullets">
                <li>57 auto-seeded checklist tasks, 7 phases</li>
                <li>Budget tracker with category breakdown</li>
                <li>Guest list, RSVP, and catering preferences</li>
                <li>Run of show + seating chart</li>
              </ul>
            </div>

            <div className="hp-feat-card reveal">
              <div className="hp-feat-icon">👗</div>
              <div className="hp-feat-title">Dress rental</div>
              <div className="hp-feat-desc">Full rental lifecycle management. Reserve, pickup, track, and return — with automated SMS reminders for overdue dresses.</div>
              <ul className="hp-feat-bullets">
                <li>Reserve → Rented → Returned → Cleaning workflow</li>
                <li>QR code scanning for quick status updates</li>
                <li>Late fee accrual ($25/day, max 30 days)</li>
                <li>Automated 48-hour return reminders via SMS</li>
              </ul>
            </div>

            <div className="hp-feat-card reveal">
              <div className="hp-feat-icon">✂️</div>
              <div className="hp-feat-title">Alterations</div>
              <div className="hp-feat-desc">A kanban board for your seamstresses. Track every alteration job from measurement to final fitting.</div>
              <ul className="hp-feat-bullets">
                <li>Measure → In progress → Fitting → Complete</li>
                <li>Seamstress assignment and urgency badges</li>
                <li>Auto-flags jobs within 7 days of event date</li>
              </ul>
            </div>

            <div className="hp-feat-card reveal">
              <div className="hp-feat-icon">💳</div>
              <div className="hp-feat-title">POS register</div>
              <div className="hp-feat-desc">A tablet-optimized point of sale designed for boutique counters. Three color-coded service zones for instant recognition.</div>
              <ul className="hp-feat-bullets">
                <li>Cash, card, Zelle, Venmo, check, and split</li>
                <li>Custom service buttons with highlight colors</li>
                <li>SMS receipt to client on checkout</li>
              </ul>
            </div>

            <div className="hp-feat-card reveal">
              <div className="hp-feat-icon">👥</div>
              <div className="hp-feat-title">Client CRM</div>
              <div className="hp-feat-desc">Every client interaction, note, and preference in one place. Loyalty tiers, sales pipeline, and win-back automation built in.</div>
              <ul className="hp-feat-bullets">
                <li>Full interaction timeline (calls, SMS, notes, meetings)</li>
                <li>5-tier loyalty program: New → Diamond</li>
                <li>VIP badges and allergy alerts propagate to events</li>
              </ul>
            </div>

            <div className="hp-feat-card reveal">
              <div className="hp-feat-icon">🏨</div>
              <div className="hp-feat-title">Hotel booking tracking</div>
              <div className="hp-feat-desc">Track room blocks, assign family guests to hotels, monitor booking cutoffs, and schedule shuttles — all from the wedding planner.</div>
              <ul className="hp-feat-bullets">
                <li>Room block progress bars per hotel</li>
                <li>Guest-to-room assignment with SMS reminders</li>
                <li>Shuttle schedule with driver contacts</li>
                <li>Cutoff alerts before block expires</li>
              </ul>
            </div>

            <div className="hp-feat-card reveal">
              <div className="hp-feat-icon">🤝</div>
              <div className="hp-feat-title">Vendor management</div>
              <div className="hp-feat-desc">Track every vendor from first inquiry to final payment. Contracts, Q&amp;A logs, venue comparison tables, and deposit status.</div>
              <ul className="hp-feat-bullets">
                <li>Stage tracking: Sourcing → Signed → Paid in full</li>
                <li>Q&amp;A log per vendor with date and answer</li>
                <li>Venue comparison with capacity and rating</li>
              </ul>
            </div>

            <div className="hp-feat-card reveal">
              <div className="hp-feat-icon">⚙️</div>
              <div className="hp-feat-title">Module system</div>
              <div className="hp-feat-desc">Enable exactly the features your boutique needs. 32 modules across 7 categories — turn them on as you grow.</div>
              <ul className="hp-feat-bullets">
                <li>4 core modules always active</li>
                <li>28 optional modules across services, ops, finance</li>
                <li>Plan-based unlocking (Starter → Growth → Pro)</li>
              </ul>
            </div>

          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="hp-section" id="hp-how">
        <div className="hp-section-inner">
          <div className="hp-how-grid">
            <div>
              <div className="hp-section-label reveal">How it works</div>
              <h2 className="hp-section-title reveal">Set up in <em>minutes</em>, run forever</h2>
              <p className="hp-section-sub reveal" style={{marginBottom:48}}>
                Belori is designed for boutique owners, not developers. No training required — if you can run a boutique, you can run Belori.
              </p>
              <div className="hp-how-steps">
                {[
                  { num:'01', title:'Create your boutique', desc:'Sign up, enter your boutique name and city, and you\'re in. Your dashboard is ready instantly with default modules enabled.' },
                  { num:'02', title:'Create your first event', desc:'Add a client, set the event date and type, and the system auto-creates milestones, tasks, and a planning workbook for weddings.' },
                  { num:'03', title:'Invite your team', desc:'Send invite links to coordinators, front desk staff, and seamstresses. Role-based permissions keep everyone seeing what they need.' },
                  { num:'04', title:'Let automations handle the rest', desc:'SMS reminders for overdue rentals, payment milestone alerts, hotel booking nudges — Belori works in the background so you don\'t have to.' },
                ].map(({ num, title, desc }) => (
                  <div className="hp-how-step reveal" key={num}>
                    <div className="hp-step-num">{num}</div>
                    <div>
                      <div className="hp-step-title">{title}</div>
                      <div className="hp-step-desc">{desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="reveal">
              <div className="hp-mock-panel">
                <div className="hp-mock-bar">
                  <div className="hp-mock-dot" style={{background:'#FF5F57'}} />
                  <div className="hp-mock-dot" style={{background:'#FEBC2E'}} />
                  <div className="hp-mock-dot" style={{background:'#28C840'}} />
                  <div className="hp-mock-url">belori.app/events</div>
                </div>
                <div className="hp-mock-body">
                  <div style={{fontSize:11,fontWeight:500,color:'#9CA3AF',textTransform:'uppercase',letterSpacing:'.05em',marginBottom:10}}>Active events — March 2026</div>
                  {[
                    { av:'SR', avBg:'#FDF5F6', avC:'#C9697A', name:'Sophia & Rafael Rodriguez', meta:'Wedding · Mar 22 · Isabel M.', bdg:'Urgent', bdgBg:'#FEE2E2', bdgC:'#B91C1C' },
                    { av:'CM', avBg:'#DBEAFE', avC:'#1D4ED8', name:'Carmen Martinez', meta:'Quinceañera · Apr 8 · Maria G.', bdg:'Active', bdgBg:'#DCFCE7', bdgC:'#15803D' },
                    { av:'IT', avBg:'#EDE9FE', avC:'#7C3AED', name:'Isabella & Thomas', meta:'Wedding · May 15 · Isabel M.', bdg:'Planning', bdgBg:'#DBEAFE', bdgC:'#1D4ED8' },
                  ].map(({ av, avBg, avC, name, meta, bdg, bdgBg, bdgC }) => (
                    <div className="hp-mock-event-row" key={av}>
                      <div className="hp-mock-av" style={{background:avBg,color:avC}}>{av}</div>
                      <div>
                        <div className="hp-mock-name">{name}</div>
                        <div className="hp-mock-meta">{meta}</div>
                      </div>
                      <div className="hp-mock-bdg" style={{background:bdgBg,color:bdgC}}>{bdg}</div>
                    </div>
                  ))}
                  <div className="hp-mock-prog-wrap">
                    <div className="hp-mock-prog-lbl">
                      <span>Monthly revenue tracking</span>
                      <span style={{color:'#C9697A',fontWeight:500}}>$42,800</span>
                    </div>
                    <div className="hp-mock-prog"><div className="hp-mock-prog-fill" style={{width:'71%'}} /></div>
                    <div style={{fontSize:10,color:'#9CA3AF',textAlign:'right',marginTop:3}}>71% of $60k goal</div>
                  </div>
                  <div style={{marginTop:14,display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    <div style={{background:'#F8F4F0',borderRadius:8,padding:10}}>
                      <div style={{fontSize:10,color:'#9CA3AF',marginBottom:2}}>Dresses rented</div>
                      <div style={{fontSize:20,fontWeight:500,color:'#C9697A',fontFamily:"'Playfair Display',serif"}}>8</div>
                    </div>
                    <div style={{background:'#F8F4F0',borderRadius:8,padding:10}}>
                      <div style={{fontSize:10,color:'#9CA3AF',marginBottom:2}}>Alterations open</div>
                      <div style={{fontSize:20,fontWeight:500,color:'#1C1012',fontFamily:"'Playfair Display',serif"}}>11</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MODULES */}
      <section className="hp-modules" id="hp-modules">
        <div className="hp-bg-dec hp-bd1" />
        <div className="hp-bg-dec hp-bd2" />
        <div className="hp-section-inner" style={{position:'relative',zIndex:1}}>
          <div className="hp-section-label reveal">32 modules</div>
          <h2 className="hp-section-title reveal">Turn on exactly what you need</h2>
          <p className="hp-section-sub reveal">Start with the essentials. Enable new modules as your boutique grows. No bloat, no confusion — just the features your team actually uses.</p>
          <div className="hp-modules-grid">
            {[
              { badge:'core', icon:'📅', name:'Events', desc:'Event creation, milestones, tasks, urgency' },
              { badge:'core', icon:'👥', name:'Clients & CRM', desc:'Client records, timeline, loyalty tiers' },
              { badge:'core', icon:'🔐', name:'Staff & Roles', desc:'Role-based permissions for your team' },
              { badge:'core', icon:'⚙️', name:'Settings', desc:'Boutique profile, modules, automations' },
              { badge:null,   icon:'👗', name:'Dress Rental', desc:'Full rental lifecycle management' },
              { badge:null,   icon:'✂️', name:'Alterations', desc:'Kanban job board for seamstresses' },
              { badge:null,   icon:'💍', name:'Wedding Planner', desc:'12-section planning workbook per event' },
              { badge:null,   icon:'✨', name:'Decoration', desc:'Linen and décor inventory tracking' },
              { badge:null,   icon:'💳', name:'POS Register', desc:'Tablet-optimized register and payments' },
              { badge:null,   icon:'🏨', name:'Hotel Tracking', desc:'Room blocks, guest assignment, shuttle' },
              { badge:'growth',icon:'🗺️', name:'Floorplan Builder', desc:'2D drag-and-drop room layouts' },
              { badge:'growth',icon:'📆', name:'Staff Scheduling', desc:'Weekly calendar with conflict detection' },
              { badge:null,   icon:'💸', name:'Payment Links', desc:'Stripe checkout for client milestones' },
              { badge:null,   icon:'🧾', name:'Expenses', desc:'Log boutique expenses for P&L tracking' },
              { badge:'growth',icon:'📊', name:'Financial Reports', desc:'Monthly P&L, top clients, forecasts' },
              { badge:'pro',  icon:'📍', name:'Multi-location', desc:'Cross-location dashboard and inventory' },
            ].map(({ badge, icon, name, desc }) => (
              <div className={`hp-mod-card${badge === 'core' ? ' hp-core' : ''} reveal`} key={name}>
                {badge === 'core'   && <span className="hp-mod-badge hp-badge-core">Core</span>}
                {badge === 'growth' && <span className="hp-mod-badge hp-badge-growth">Growth</span>}
                {badge === 'pro'    && <span className="hp-mod-badge hp-badge-pro">Pro</span>}
                <div className="hp-mod-icon">{icon}</div>
                <div className="hp-mod-name">{name}</div>
                <div className="hp-mod-desc">{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="hp-section" style={{background:'#F8F4F0'}}>
        <div className="hp-section-inner">
          <div className="hp-section-label reveal">Testimonials</div>
          <h2 className="hp-section-title reveal">What boutique owners are <em>saying</em></h2>
          <div className="hp-testi-grid">
            {[
              { stars:5, text:"Before Belori, I was juggling three spreadsheets, a notes app, and sticky notes on my desk. Now everything is in one place and my team actually knows what's happening.", avInit:'IM', avBg:'#FDF5F6', avC:'#C9697A', name:'Isabel Martinez', role:'Owner · Bella Bridal & Events, McAllen TX' },
              { stars:5, text:"The wedding planning module alone is worth it. My coordinators love the run-of-show builder, and families are using the hotel tracker without needing us to babysit every booking.", avInit:'SR', avBg:'#EDE9FE', avC:'#7C3AED', name:'Sofia Rivera', role:'Coordinator · Elegance Bridal, San Antonio TX' },
              { stars:5, text:"The SMS reminders for dress returns paid for the subscription in the first month. I had three overdue dresses I didn't even know about. Now guests get a reminder at 48 hours automatically.", avInit:'LC', avBg:'#DCFCE7', avC:'#15803D', name:'Lucia Contreras', role:'Owner · Novela Boutique, McAllen TX' },
            ].map(({ stars, text, avInit, avBg, avC, name, role }) => (
              <div className="hp-testi-card reveal" key={name}>
                <div className="hp-testi-stars">{'★'.repeat(stars)}</div>
                <div className="hp-testi-quote">"</div>
                <p className="hp-testi-text">{text}</p>
                <div className="hp-testi-author">
                  <div className="hp-testi-av" style={{background:avBg,color:avC}}>{avInit}</div>
                  <div>
                    <div className="hp-testi-name">{name}</div>
                    <div className="hp-testi-role">{role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section className="hp-section" id="hp-pricing">
        <div className="hp-section-inner">
          <div style={{textAlign:'center',maxWidth:600,margin:'0 auto 56px'}}>
            <div className="hp-section-label reveal" style={{justifyContent:'center'}}>Pricing</div>
            <h2 className="hp-section-title reveal">Simple pricing,<br/><em>serious value</em></h2>
            <p className="hp-section-sub reveal" style={{margin:'0 auto'}}>Start with a 14-day free trial. No credit card required. Cancel anytime.</p>
          </div>
          <div className="hp-pricing-grid">

            <div className="hp-price-card reveal">
              <div className="hp-price-tier">Starter</div>
              <div className="hp-price-amount">
                <div className="hp-price-dollar">$</div>
                <div className="hp-price-num">49</div>
                <div className="hp-price-period">/mo</div>
              </div>
              <div className="hp-price-desc">For small boutiques getting organized. Everything you need to start running events and rentals professionally.</div>
              <div className="hp-price-divider" />
              <ul className="hp-price-features">
                {['Events, Clients & CRM','Dress rental management','Alterations kanban','POS register','Wedding planner module','Up to 3 staff members','SMS automations (500/mo)'].map(f => (
                  <li key={f}><span className="hp-check">✓</span> {f}</li>
                ))}
              </ul>
              <button className="hp-price-btn hp-price-btn-outline" onClick={() => navigate('/signup')}>Start free trial</button>
            </div>

            <div className="hp-price-card hp-popular reveal">
              <div className="hp-popular-badge">Most popular</div>
              <div className="hp-price-tier">Growth</div>
              <div className="hp-price-amount">
                <div className="hp-price-dollar">$</div>
                <div className="hp-price-num">129</div>
                <div className="hp-price-period">/mo</div>
              </div>
              <div className="hp-price-desc">For established boutiques ready to scale. Advanced modules, automation, and team management.</div>
              <div className="hp-price-divider" />
              <ul className="hp-price-features">
                {['Everything in Starter','Floorplan builder','Staff scheduling','Client portal & booking','Financial reports & export','Up to 10 staff members','SMS automations (2,500/mo)','Accounting export'].map(f => (
                  <li key={f}><span className="hp-check">✓</span> {f}</li>
                ))}
              </ul>
              <button className="hp-price-btn hp-price-btn-fill" onClick={() => navigate('/signup')}>Start free trial</button>
            </div>

            <div className="hp-price-card reveal">
              <div className="hp-price-tier">Pro</div>
              <div className="hp-price-amount">
                <div className="hp-price-dollar">$</div>
                <div className="hp-price-num">299</div>
                <div className="hp-price-period">/mo</div>
              </div>
              <div className="hp-price-desc">For multi-location boutiques and enterprise operations. Unlimited everything, dedicated support.</div>
              <div className="hp-price-divider" />
              <ul className="hp-price-features">
                {['Everything in Growth','Multi-location dashboard','F&B / BEO management','Unlimited staff members','SMS automations (unlimited)','Dedicated onboarding call','Priority support','Custom integrations'].map(f => (
                  <li key={f}><span className="hp-check">✓</span> {f}</li>
                ))}
              </ul>
              <button className="hp-price-btn hp-price-btn-outline" onClick={() => navigate('/signup')}>Contact sales</button>
            </div>

          </div>
          <div style={{textAlign:'center',marginTop:24,fontSize:13,color:'#9C8A8C'}}>
            All plans include a 14-day free trial. Need something custom?{' '}
            <button onClick={() => navigate('/signup')} style={{color:'#C9697A',background:'none',border:'none',cursor:'pointer',fontWeight:500,fontSize:13,fontFamily:'inherit'}}>
              Talk to us →
            </button>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="hp-cta-section">
        <div className="hp-section-inner" style={{position:'relative',zIndex:1}}>
          <h2 className="hp-section-title reveal" style={{marginBottom:16}}>
            Ready to run your boutique<br/><em>beautifully?</em>
          </h2>
          <p className="hp-section-sub reveal">Join 200+ boutiques already using Belori. Set up in minutes, no training required.</p>
          <div className="reveal" style={{marginTop:40}}>
            <button className="hp-btn-white" onClick={() => navigate('/signup')}>
              Start your free 14-day trial
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <div className="hp-cta-note">No credit card required · Cancel anytime · Setup in under 5 minutes</div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="hp-footer">
        <div className="hp-footer-inner">
          <div className="hp-footer-top">
            <div>
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <div style={{width:32,height:32,background:'#C9697A',borderRadius:7,display:'flex',alignItems:'center',justifyContent:'center'}}>
                  <svg width="16" height="16" viewBox="0 0 32 32" fill="none">
                    <path d="M7 25V7l18 18V7" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <span className="hp-footer-brand-text">Belori</span>
              </div>
              <p className="hp-footer-brand-sub" style={{marginTop:14}}>Every celebration, beautifully managed. Built for bridal boutiques that refuse to compromise.</p>
              <div style={{marginTop:20,fontStyle:'italic',fontFamily:"'Playfair Display',serif",fontSize:14,color:'rgba(201,105,122,.5)'}}>
                "Every celebration, beautifully managed."
              </div>
            </div>
            <div>
              <div className="hp-footer-col-title">Product</div>
              <ul className="hp-footer-links">
                <li><a href="#hp-features" onClick={scrollTo('hp-features')}>Features</a></li>
                <li><a href="#hp-modules" onClick={scrollTo('hp-modules')}>Modules</a></li>
                <li><a href="#hp-pricing" onClick={scrollTo('hp-pricing')}>Pricing</a></li>
                <li><a href="#">Changelog</a></li>
                <li><a href="#">Roadmap</a></li>
              </ul>
            </div>
            <div>
              <div className="hp-footer-col-title">Company</div>
              <ul className="hp-footer-links">
                <li><a href="#">About</a></li>
                <li><a href="#">Blog</a></li>
                <li><a href="#">Careers</a></li>
                <li><a href="#">Contact</a></li>
                <li><a href="#">Partner program</a></li>
              </ul>
            </div>
            <div>
              <div className="hp-footer-col-title">Support</div>
              <ul className="hp-footer-links">
                <li><a href="#">Help center</a></li>
                <li><a href="#">Documentation</a></li>
                <li><a href="#">Status</a></li>
                <li><a href="#">Privacy policy</a></li>
                <li><a href="#">Terms of service</a></li>
              </ul>
            </div>
          </div>
          <div className="hp-footer-divider" />
          <div className="hp-footer-bottom">
            <div>© 2026 Belori. All rights reserved.</div>
            <div className="hp-footer-tagline">Built for boutiques that believe in beautiful.</div>
          </div>
        </div>
      </footer>
    </div>
  )
}

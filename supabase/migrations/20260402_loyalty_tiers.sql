alter table boutiques add column if not exists loyalty_tiers jsonb default '[
  {"name":"Bronze","min_points":0,"color":"#cd7f32","perks":["Priority booking"]},
  {"name":"Silver","min_points":500,"color":"#c0c0c0","perks":["5% discount","Priority booking"]},
  {"name":"Gold","min_points":1500,"color":"#ffd700","perks":["10% discount","Free alteration consultation","Priority booking"]},
  {"name":"Platinum","min_points":3000,"color":"#e5e4e2","perks":["15% discount","Free alteration","Dedicated coordinator","Priority booking"]}
]'::jsonb;

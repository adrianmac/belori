// Default tiers used when boutique.loyalty_tiers is not set
export const DEFAULT_LOYALTY_TIERS = [
  { name: 'Bronze',   min_points: 0,    color: '#cd7f32', perks: ['Priority booking'] },
  { name: 'Silver',   min_points: 500,  color: '#c0c0c0', perks: ['5% discount', 'Priority booking'] },
  { name: 'Gold',     min_points: 1500, color: '#ffd700', perks: ['10% discount', 'Free alteration consultation', 'Priority booking'] },
  { name: 'Platinum', min_points: 3000, color: '#e5e4e2', perks: ['15% discount', 'Free alteration', 'Dedicated coordinator', 'Priority booking'] },
];

/**
 * Returns the current tier object for a given point value.
 * tiers must be an array of { name, min_points, color, perks }.
 */
export function getTier(points, tiers) {
  const sorted = [...(tiers || DEFAULT_LOYALTY_TIERS)].sort((a, b) => b.min_points - a.min_points);
  return sorted.find(t => points >= t.min_points) || sorted[sorted.length - 1];
}

/**
 * Returns { tier, pointsNeeded } for the next tier above the current one,
 * or null if already at the top tier.
 */
export function getNextTier(points, tiers) {
  const list = [...(tiers || DEFAULT_LOYALTY_TIERS)].sort((a, b) => a.min_points - b.min_points);
  const next = list.find(t => t.min_points > points);
  if (!next) return null;
  return { tier: next, pointsNeeded: next.min_points - points };
}

/** Medal emoji for a tier by index (0=Bronze, 1=Silver, 2=Gold, 3+=Platinum) */
export function tierMedal(tierName) {
  const medals = { Bronze: '🥉', Silver: '🥈', Gold: '🥇', Platinum: '💎' };
  return medals[tierName] || '🏅';
}

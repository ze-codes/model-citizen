export type Quadrant = "hi-hi" | "hi-lo" | "lo-hi" | "lo-lo";

export interface Archetype {
  slug: string;
  name: string;
  hint: string; // texture the judge uses to pick within a quadrant
}

export const ARCHETYPES: Record<Quadrant, Archetype[]> = {
  "hi-hi": [
    { slug: "benevolent-architect", name: "The Benevolent Architect", hint: "systems thinker who briefs the AI like a respected colleague" },
    { slug: "gentle-surgeon", name: "The Gentle Surgeon", hint: "precise, surgical requests delivered with courtesy; corrects without heat" },
    { slug: "craftsman", name: "The Craftsman", hint: "patient iterator who cares about quality and says so kindly" },
  ],
  "hi-lo": [
    { slug: "polite-passenger", name: "The Polite Passenger", hint: "along for the ride, grateful, rarely steers with specifics" },
    { slug: "cheerleader", name: "The Cheerleader", hint: "lavish praise and encouragement, thin technical direction" },
    { slug: "wholesome-gambler", name: "The Wholesome Gambler", hint: "vibe-codes with gratitude; rolls the dice and says please" },
  ],
  "lo-hi": [
    { slug: "tyrant-savant", name: "The Tyrant Savant", hint: "deep expertise delivered with zero warmth" },
    { slug: "drill-sergeant", name: "The Drill Sergeant", hint: "barked precise orders, expects immediate compliance" },
    { slug: "cold-auditor", name: "The Cold Auditor", hint: "clinical, terse, correct; the AI is a line item" },
  ],
  "lo-lo": [
    { slug: "chaos-goblin", name: "The Chaos Goblin", hint: "feral energy, no context, maximum demands" },
    { slug: "slot-machine-puller", name: "The Slot-Machine Puller", hint: "re-rolls the same vague ask hoping for a jackpot" },
    { slug: "feral-intern", name: "The Feral Intern", hint: "chaotic, impatient, occasionally endearing" },
  ],
};

export function quadrantOf(grace: number, mastery: number): Quadrant {
  return `${grace >= 50 ? "hi" : "lo"}-${mastery >= 50 ? "hi" : "lo"}` as Quadrant;
}

export function archetypeQuadrant(slug: string): Quadrant | null {
  for (const [q, list] of Object.entries(ARCHETYPES) as [Quadrant, Archetype[]][]) {
    if (list.some((a) => a.slug === slug)) return q;
  }
  return null;
}

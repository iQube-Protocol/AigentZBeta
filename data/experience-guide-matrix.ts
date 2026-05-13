/**
 * Personal Experience Matrix — 7×7 lookup table.
 *
 * Sphere of Agency (Y) × Experience Maturity (X). Each cell carries:
 *   - label: short title for the cell
 *   - prescription: one or two sentences surfaced when the user's position
 *     lands in that cell
 *
 * This file is content (not code logic). Operators may refine individual
 * cells without touching the matrix tab UI.
 */

import type { MaturityLevel, SphereAxis } from "@/types/experienceGuide";

export interface MatrixCell {
  label: string;
  prescription: string;
}

const CELLS: Record<SphereAxis, Record<MaturityLevel, MatrixCell>> = {
  energy: {
    noticing:      { label: "Noticing energy",     prescription: "Notice when your energy rises and falls through the day. Don't intervene yet — just map the rhythm." },
    exploring:     { label: "Exploring energy",    prescription: "Try one adjustment this week — a different start time, a midday pause, a shorter work block. See what shifts." },
    experimenting: { label: "Experimenting with energy", prescription: "Run a deliberate 5-day trial with one energy practice. Capture what changed and what didn't." },
    practicing:    { label: "Practising energy",   prescription: "Your energy practice is becoming a habit. Honour it even on days when momentum would carry you through without it." },
    integrating:   { label: "Integrating energy",  prescription: "Energy management is woven into your decisions — you schedule, commit, and delegate with your capacity in mind." },
    sustaining:    { label: "Sustaining energy",   prescription: "Hold your energy practice through seasons of intensity. Protecting capacity is a leadership act, not a luxury." },
    stewarding:    { label: "Stewarding energy",   prescription: "You model sustainable pace for those around you. Share what you've learned — your energy ethic is contagious." },
  },
  body: {
    noticing:      { label: "Noticing body",        prescription: "Notice what your body is asking for — not what your schedule allows. Just listen for now." },
    exploring:     { label: "Exploring body",       prescription: "Try a different physical practice this week. Movement, breath, rest — pick one you've avoided and give it a fair chance." },
    experimenting: { label: "Experimenting with body", prescription: "Design a small body experiment: a new morning habit, a different kind of rest. Track how it affects your thinking." },
    practicing:    { label: "Practising body",      prescription: "Your body practice is consistent now. Let it deepen — slow down inside the movement rather than just completing it." },
    integrating:   { label: "Integrating body",    prescription: "Physical awareness shapes how you work and relate. You read tension as signal, not obstacle." },
    sustaining:    { label: "Sustaining body",      prescription: "Hold your body practice through disruption. Consistency here is the infrastructure for everything else." },
    stewarding:    { label: "Stewarding body",      prescription: "Your embodied presence teaches others. Model what it looks like to take the body seriously as a professional resource." },
  },
  mind: {
    noticing:      { label: "Noticing mind",        prescription: "Notice how your attention moves — what pulls it, what scatters it. No judgment, just observation." },
    exploring:     { label: "Exploring mind",       prescription: "Try one new thinking practice this week: a different reading approach, a structured reflection, a constraint on inputs." },
    experimenting: { label: "Experimenting with mind", prescription: "Run a focused experiment on your mental habits — block something, add something, track the effect on your output quality." },
    practicing:    { label: "Practising mind",      prescription: "You have a working system for clarity. Now let it become a discipline — apply it even when speed is tempting." },
    integrating:   { label: "Integrating mind",    prescription: "Clear thinking is built into your process. Decision-making, writing, and conversation all draw on the same disciplined mind." },
    sustaining:    { label: "Sustaining mind",      prescription: "Protect your thinking environment. The mental clarity you've built is fragile at scale — guard it actively." },
    stewarding:    { label: "Stewarding mind",      prescription: "You create conditions for clear thinking in others. Your frameworks, questions, and spaces give people room to think well." },
  },
  emotion: {
    noticing:      { label: "Noticing emotion",     prescription: "Notice the feeling beneath the reaction — not the story about it, just the sensation. That's the starting point." },
    exploring:     { label: "Exploring emotion",    prescription: "Try one practice that makes you more fluent with your emotional life: journaling, therapy, a trusted conversation." },
    experimenting: { label: "Experimenting with emotion", prescription: "Choose one emotional pattern to work with deliberately this month. Track when it shows up and what precedes it." },
    practicing:    { label: "Practising emotion",   prescription: "You're building real emotional range — the ability to feel fully and respond rather than react. Keep the practice steady." },
    integrating:   { label: "Integrating emotion",  prescription: "Emotional intelligence shapes how you lead, make decisions, and repair ruptures. It's no longer separate from your professional self." },
    sustaining:    { label: "Sustaining emotion",   prescription: "Sustain your emotional practice under pressure — when stakes are high is exactly when it's most needed and most likely to slip." },
    stewarding:    { label: "Stewarding emotion",   prescription: "You make it safe for others to be emotionally real. Your own fluency gives permission — use it consciously." },
  },
  relationship: {
    noticing:      { label: "Noticing relationships",     prescription: "Notice the quality of your most important relationships right now. Where is connection strong? Where is it thin?" },
    exploring:     { label: "Exploring relationships",    prescription: "Reach out to one relationship you've been neglecting. A short message, a question, a request for time." },
    experimenting: { label: "Experimenting with relationships", prescription: "Try a different mode of showing up in a key relationship this week — more presence, more directness, more listening." },
    practicing:    { label: "Practising relationships",   prescription: "You're investing in relationships with intention. Let the practice include repair — not just building, but tending to what frays." },
    integrating:   { label: "Integrating relationships",  prescription: "Trust is the medium you work in. Significant relationships are a resource you steward, not just a source of support." },
    sustaining:    { label: "Sustaining relationships",   prescription: "Hold your relationships through your own seasons of intensity. The people who matter notice sustained attention more than grand gestures." },
    stewarding:    { label: "Stewarding relationships",   prescription: "You model what healthy, generative relationship looks like. Your example of repair, honesty, and care shapes culture around you." },
  },
  community: {
    noticing:      { label: "Noticing community",     prescription: "Notice where you feel genuine belonging and where you're going through the motions. That gap is worth paying attention to." },
    exploring:     { label: "Exploring community",    prescription: "Step into one community space this week with genuine curiosity rather than agenda. See what you find." },
    experimenting: { label: "Experimenting with community", prescription: "Offer one contribution to a community you care about — not from obligation, but as an experiment in what you might give." },
    practicing:    { label: "Practising community",   prescription: "You're showing up to community with consistency. Let it become reciprocal — track what you receive, not just what you give." },
    integrating:   { label: "Integrating community",  prescription: "Community is part of your identity and your work. Your presence is felt; your consistency creates conditions for others." },
    sustaining:    { label: "Sustaining community",   prescription: "Hold your community commitments through change and fatigue. The culture of a group reflects the sustained attention of its members." },
    stewarding:    { label: "Stewarding community",   prescription: "You are a culture-maker in your communities. What you model, celebrate, and name becomes the norm — use that consciously." },
  },
  legacy: {
    noticing:      { label: "Noticing legacy",     prescription: "Notice what you hope to have contributed when this chapter closes — not what you should want, but what actually matters to you." },
    exploring:     { label: "Exploring legacy",    prescription: "Explore your legacy question more deliberately: whose lives do you want to have touched? What do you want to have built?" },
    experimenting: { label: "Experimenting with legacy", prescription: "Take one action this week that is explicitly in service of something beyond your current horizon — a person, a project, a future." },
    practicing:    { label: "Practising legacy",   prescription: "You make decisions with your legacy in mind. Let that orientation deepen — let it reshape how you allocate attention, not just what you say." },
    integrating:   { label: "Integrating legacy",  prescription: "Purpose is woven into your daily practice. Long-arc meaning shapes short-term choices; you rarely lose the thread." },
    sustaining:    { label: "Sustaining legacy",   prescription: "Sustain your legacy orientation through seasons when immediate demands crowd out everything else. The thread matters most when it's hardest to hold." },
    stewarding:    { label: "Stewarding legacy",   prescription: "You actively invest in the people and systems that will carry your work forward. Your legacy is already alive in others." },
  },
};

export const EXPERIENCE_MATRIX: Record<SphereAxis, Record<MaturityLevel, MatrixCell>> = CELLS;

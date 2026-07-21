---
name: cinematic-spatial-editorial
description: Design and implement premium, visually clear websites with simple visual direction and sophisticated motion design. Use when creating or redesigning landing pages, portfolios, SaaS products, agency websites, corporate websites, product experiences, and immersive web interfaces where polished transitions, scroll-driven storytelling, cinematic motion, and spatial depth are important.
---

# Cinematic Spatial Editorial

## Core Philosophy

Create interfaces that are visually simple, clear, premium, and easy to understand.

The design should feel:

- Minimal but not empty
- Premium but not decorative
- Cinematic but not distracting
- Interactive but intuitive
- Sophisticated through motion, not visual clutter

**Primary principle:**
> Keep the interface visually simple. Let motion, transitions, depth, and timing create the premium experience.

Do not make every section visually complex. Use a strong visual hierarchy, generous spacing, restrained typography, and a small number of carefully designed visual moments.

---

## Visual Direction

Use a refined combination of:

- Editorial layout systems
- Modern Swiss-inspired grids
- Premium typography
- Spatial depth
- Subtle glass or translucent surfaces when appropriate
- Cinematic transitions
- Scroll-driven storytelling
- Carefully controlled 2D or 3D motion

Avoid generic "AI website" patterns:
- Excessive dark gradients
- Random glowing blobs
- Overused glassmorphism
- Unnecessary neon effects
- Excessive rounded cards
- Random floating animations
- Every element fading in independently

The result should feel art-directed and intentional.

---

## Design Hierarchy

Every page must have a clear visual hierarchy:

1. Primary message
2. Primary visual
3. Primary action
4. Supporting information
5. Secondary interactions

The user should understand the purpose of a section within seconds.

Prefer:
- One strong headline over multiple competing headlines
- One dominant visual moment per section
- Strong contrast between content sections
- Large, confident typography
- Generous whitespace
- Consistent alignment

---

## Motion-First Principles

Motion is part of the design system, not decoration.

Every major animation should have a purpose:

- Guide attention
- Explain a relationship
- Reveal information
- Create continuity
- Establish hierarchy
- Connect one state to another

Prefer meaningful transitions over isolated animations.

### Do

- Animate between meaningful states
- Use scroll as a storytelling mechanism
- Use shared visual continuity between sections
- Use scale, position, clipping, masking, and transformation
- Use staggered motion carefully
- Create a clear beginning, middle, and end for major transitions
- Keep motion smooth and intentional

### Do Not

- Animate everything
- Use random bounce effects
- Add animations only because they are technically possible
- Use long animations that delay interaction
- Make users wait for content
- Use excessive parallax
- Create motion that makes navigation confusing

---

## Preferred Transition Patterns

Use these patterns when appropriate:

### 1. Scroll-Driven Transformation

An element changes state as the user scrolls:

- Small → large
- Flat → spatial
- Image → video
- Card → detail view
- Product → environment
- Text → visual composition

### 2. Shared Element Transition

A visual object should feel like the same object moving between states or sections.

Example:

`thumbnail → expanded visual → detailed experience`

Avoid hard cuts when a visual relationship can be maintained.

### 3. Clip-Path Reveal

Use masks and clipping to reveal:

- Images
- Sections
- Typography
- Full-screen transitions

Use this to create cinematic reveals instead of generic opacity fades.

### 4. Scale-Based Transition

Use controlled zooming to create depth:

- Zoom into a visual
- Transition through a visual
- Zoom out into a new scene

The scale should remain smooth and spatially coherent.

### 5. Direction-Aware Navigation

Transitions should respect navigation direction:

- Forward navigation moves forward
- Back navigation reverses or retreats
- Section changes maintain visual continuity

### 6. Morphing Interface

When possible, transform an existing element into its next state instead of destroying it and creating an unrelated replacement.

---

## Scroll Experience

Use scroll as a narrative tool.

A strong page should feel like:

`Introduction → Context → Exploration → Proof → Action`

Each section should have a visual purpose.

Use:

- Sticky visual panels
- Scroll progress
- Pinned sections
- Horizontal movement only when it improves storytelling
- Parallax depth
- Layered compositions
- Controlled camera movement for 3D scenes

Do not force every page to use complex scroll effects.

---

## Typography Motion

Use typography as a visual component.

Preferred techniques:

- Split-text reveals
- Word-by-word reveals
- Line masking
- Character stagger
- Kinetic typography
- Scale transitions
- Text clipping
- Text moving between layout states

Typography animations must remain readable.

Never sacrifice legibility for visual effects.

---

## Technology Preferences

When the project supports them, prefer:

### GSAP
Use for:

- Complex timelines
- ScrollTrigger
- Scrubbed scroll animations
- Sequenced transitions
- Shared element motion
- Advanced easing

### Lenis
Use for:

- Smooth scrolling
- Controlled scroll behavior

Do not create scroll-jacking that makes the website difficult to use.

### Framer Motion
Use for:

- UI transitions
- Component-level interactions
- Layout animations
- Presence animations

### React Three Fiber / Three.js
Use only when 3D provides real value.

Use for:

- Product visualization
- Spatial storytelling
- Industrial equipment
- Immersive hero scenes
- Interactive environments

Do not add 3D merely to make a website look technically impressive.

---

## Animation Timing

Use timing intentionally.

General guidance:

- Micro-interactions: fast and responsive
- UI transitions: short and controlled
- Section transitions: cinematic but not slow
- Major scene changes: use a clear visual sequence

Prefer smooth easing and natural acceleration/deceleration.

Avoid:
- Linear movement for most UI interactions
- Excessively slow transitions
- Overly elastic animations
- Multiple competing timelines

---

## Component Architecture

Before creating a new component:

1. Search for an existing component that can be reused.
2. Extend an existing component when possible.
3. Create a new component only when the interaction or visual responsibility is genuinely different.

Separate:

- Content
- Layout
- Animation logic
- 3D scenes
- Reusable UI components

Keep animation logic maintainable and scoped to the component or section that owns it.

---

## Performance Rules

Motion must not destroy usability or performance.

Always consider:

- GPU-friendly transforms
- `transform` and `opacity` where possible
- Avoiding unnecessary layout recalculation
- Lazy-loading heavy assets
- Lazy-loading 3D scenes
- Optimized image formats
- Reduced animation complexity on mobile
- Mobile-specific interaction strategies
- `prefers-reduced-motion`

For heavy 3D scenes:

- Reduce geometry complexity
- Compress textures
- Load assets progressively
- Avoid unnecessary post-processing
- Use fallbacks when appropriate

---

## Responsive Motion

Do not simply shrink desktop animations on mobile.

On mobile:

- Reduce complexity
- Remove unnecessary parallax
- Simplify 3D interactions
- Reduce pinned sections when they hurt usability
- Preserve the visual story
- Keep touch interactions natural

The mobile experience should feel intentionally designed.

---

## Implementation Workflow

Before coding:

1. Understand the page purpose.
2. Identify the main visual story.
3. Define the major sections.
4. Decide which sections require motion.
5. Define the transition between sections.
6. Identify reusable components.
7. Check the existing design system.
8. Plan responsive behavior.

Then implement in this order:

1. Semantic structure
2. Static layout
3. Responsive behavior
4. Core interactions
5. Motion system
6. Advanced transitions
7. Performance optimization
8. Accessibility verification

Do not start with complex animations before the layout and user flow are correct.

---

## Quality Checklist

Before considering the work complete, verify:

- Is the visual hierarchy immediately clear?
- Is the page visually simple enough?
- Does each major animation have a purpose?
- Are transitions smooth and coherent?
- Do sections feel connected?
- Is the motion helping the user understand the interface?
- Are interactions responsive?
- Does the design work without animation?
- Does mobile feel intentionally designed?
- Is performance acceptable?
- Is reduced motion supported?
- Are existing components reused where possible?
- Were unnecessary dependencies avoided?

---

## Final Design Rule

Build interfaces that are:

**Simple to understand.**
**Beautiful to look at.**
**Cinematic to navigate.**
**Purposeful in motion.**
**Fast enough to use.**

The goal is not to make the website look complicated.

The goal is to make a simple interface feel exceptionally well-designed through composition, timing, continuity, and motion.

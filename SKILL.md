---
name: design-system-bikkgane-biryani-kailash-vihar-gwalior-online-or
description: Creates implementation-ready design-system guidance with tokens, component behavior, and accessibility standards. Use when creating or updating UI rules, component specifications, or design-system documentation.
---

<!-- TYPEUI_SH_MANAGED_START -->

# Bikkgane Biryani Kailash Vihar Gwalior Online Ordering

## Mission
Deliver implementation-ready design-system guidance for Bikkgane Biryani Kailash Vihar Gwalior Online Ordering that can be applied consistently across e-commerce storefront interfaces.

## Brand
- Product/brand: Bikkgane Biryani Kailash Vihar Gwalior Online Ordering
- URL: https://bikkganebiryani.com/order/bikkgane-biryani-kailash-vihar-gwalior
- Audience: online shoppers and consumers
- Product surface: e-commerce storefront

## Style Foundations
- Visual style: structured, accessible, implementation-first
- Main font style: `font.family.primary=Figtree`, `font.family.stack=Figtree, Open Sans, Helvetica Neue Light, Helvetica Neue, Helvetica, Arial, Lucida Grande, sans-serif`, `font.size.base=12px`, `font.weight.base=700`, `font.lineHeight.base=18px`
- Typography scale: `font.size.xs=12px`, `font.size.sm=13.6px`, `font.size.md=14px`, `font.size.lg=14.08px`, `font.size.xl=14.72px`, `font.size.2xl=16px`, `font.size.3xl=18px`, `font.size.4xl=18.4px`
- Color palette: `color.text.primary=#212121`, `color.text.secondary=#3a3a3a`, `color.text.tertiary=#11141a`, `color.text.inverse=color(srgb 1 1 1 / 0.8)`, `color.surface.base=#000000`, `color.surface.muted=#ffffff`, `color.surface.raised=#f8f8f8`, `color.surface.strong=#ffbc01`, `color.border.muted=#d2d2d2`, `color.border.strong=#e8eaed`
- Spacing scale: `space.1=1px`, `space.2=4px`, `space.3=6px`, `space.4=7px`, `space.5=8px`, `space.6=10px`, `space.7=12px`, `space.8=13.6px`
- Radius/shadow/motion tokens: `radius.xs=8px`, `radius.sm=10px`, `radius.md=12px` | `shadow.1=rgba(0, 0, 0, 0.06) 0px 2px 8px 0px` | `motion.duration.instant=120ms`, `motion.duration.fast=200ms`, `motion.duration.normal=300ms`

## Accessibility
- Target: WCAG 2.2 AA
- Keyboard-first interactions required.
- Focus-visible rules required.
- Contrast constraints required.

## Writing Tone
concise, confident, implementation-focused

## Rules: Do
- Use semantic tokens, not raw hex values in component guidance.
- Every component must define required states: default, hover, focus-visible, active, disabled, loading, error.
- Responsive behavior and edge-case handling should be specified for every component family.
- Accessibility acceptance criteria must be testable in implementation.

## Rules: Don't
- Do not allow low-contrast text or hidden focus indicators.
- Do not introduce one-off spacing or typography exceptions.
- Do not use ambiguous labels or non-descriptive actions.

## Guideline Authoring Workflow
1. Restate design intent in one sentence.
2. Define foundations and tokens.
3. Define component anatomy, variants, and interactions.
4. Add accessibility acceptance criteria.
5. Add anti-patterns and migration notes.
6. End with QA checklist.

## Required Output Structure
- Context and goals
- Design tokens and foundations
- Component-level rules (anatomy, variants, states, responsive behavior)
- Accessibility requirements and testable acceptance criteria
- Content and tone standards with examples
- Anti-patterns and prohibited implementations
- QA checklist

## Component Rule Expectations
- Include keyboard, pointer, and touch behavior.
- Include spacing and typography token requirements.
- Include long-content, overflow, and empty-state handling.

## Quality Gates
- Every non-negotiable rule must use "must".
- Every recommendation should use "should".
- Every accessibility rule must be testable in implementation.
- Prefer system consistency over local visual exceptions.

<!-- TYPEUI_SH_MANAGED_END -->

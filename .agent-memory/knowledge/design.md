# Verified project design context
- Burger Budds brand tokens: yellow #f7ce0c and green #4c6d3e; preserve existing Tailwind components.
- User source: PLAN.md and initial task, 2026-10-23. Not competitor research.
- Learn reference ordering flows only; never copy another brand's text, design, images or logos.
- Existing DESIGN.md contains reference-brand material; it does not override Burger Budds instructions.
- New UI should provide visible loading/error/empty states, keyboard focus and mobile touch targets.
- Accessible reduced-motion loading boundaries now cover global/store/outlet navigation (2026-10-23).
- Requested map reference: user screenshot/checkout link (2026-10-24); map/search/current-location/pin/serviceability flow only. Reference checkout was inaccessible via web fetch; no brand assets copied. Google map integration remains pending; mobile GPS repair is separate.
- GPS requires secure context and permission; longer acquisition may be needed. MDN getCurrentPosition docs checked 2026-10-24: https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition

- Approved delivery marker (2026-10-24): large yellow drop pin, green outline, white center; tip anchors exact point. GPS button icon is separate.

- Manual rider handover (2026-10-24): inline name/mobile form, Save & Hand Over, visible errors/pending; customer sees saved rider name and tel link after assignment.

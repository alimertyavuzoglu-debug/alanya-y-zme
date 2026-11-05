# Design QA — selected hybrid

Source: /workspace/generated_images/exec-7314713c-7f00-4f2f-9fc1-291b6758f210.png.
Target: public homepage /, desktop 1487×1058 CSS pixels, deviceScaleFactor 1. Reference PNG 1487×1058. Captures at the same viewport and scroll-top state. Mobile: 390×844 CSS pixels, full-page capture. No browser/device frame.

## Comparison history

1. Initial combined evidence: test-results/design-comparison.png (source left, implementation right; 2974×1058). P2: vertical heading dividers differed from horizontal rules; program headings were undersized and the program images began too low. P2: logo was typography rather than a raster mark. Fixed with horizontal rules, larger program headings, tighter hero/program rhythm, generated white/yellow monogram.
2. Post-fix full comparison: /workspace/verification/design-comparison-iteration-2.png; focused header: test-results/design-header-comparison.png, source above implementation. P2: desktop navigation started too far right and lacked the selected underline. Fixed using a bounded flexible navigation track and an accessible current-location state. Program intro spacing tightened slightly.
3. Final paired capture reviewed: /workspace/verification/design-comparison-final.png (2974×1058, source left / implementation right) and /workspace/verification/design-header-final.png (1487×320, source header above implementation). Navigation now fills the reference track, current-location underline is visible, hero/program composition and horizontal dividers agree. Remaining differences are P3 raster/font/photo variations; no actionable P0/P1/P2 visual findings remain.

## Fidelity surfaces

- Typography: local Fraunces serif display + Instrument sans UI/body. Same two-line hero copy and serif/sans hierarchy. Minor glyph differences from generated reference accepted; live text is editable.
- Rhythm: full-width hero, left-aligned headline/actions, white editorial introduction, two program columns. Program titles and divider orientation corrected in iteration 1.
- Colors: cobalt #0739c8, deep navy, white, yellow #ffd52e. No red accents. Mobile photo shade is stronger for legibility.
- Images: generated standalone hero/swim/cycling images share subject, focal layout and palette. They are not screenshots pasted into the page. Generated monogram is a real PNG asset; headings remain editable HTML. Photo variations are expected because individual assets were generated from the reference.
- Copy: exact approved hero, intro, program titles/copy, plus requested functional about/contact sections below reference fold. CTA leads to contact; telephone opens call handler, not a fake submission success.

## Interaction evidence

9 browser scenarios passed before final header adjustment: real anonymous API denial and redirects; mocked admin login/logout and coach rejection; group/term editing; lesson roster/attendance/report export; mobile no overflow/dialog Escape; desktop pageerror check; public navigation/contact; CMS edit/upload/publish and stale-write conflict. Authenticated CMS network calls were mocked in browser tests. Local PostgreSQL tests cover role isolation, publish revision and Storage policies. Real Supabase 003 migration and authenticated write/upload remain pending.

## Follow-up polish

P3: monogram's generated raster edge texture is slightly rough at original size; unobtrusive at header display size. A vector brand file supplied later would improve it. Further photo compression can reduce initial bandwidth. No unverified club credentials, awards or statistics added.

final result: passed

Final public navigation/contact/mobile scenario rerun after the header fix: 1/1 passed, with no pageerror. Authenticated remote persistence is an environment prerequisite, not a visual-QA pass claim.

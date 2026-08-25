const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'PogoPvp.html'), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

[
  '--ui-radius-control:',
  '--ui-radius-surface:',
  '--ui-radius-dialog:',
  '--ui-motion-fast:',
  '--ui-motion-standard:',
  '--ui-focus-ring:'
].forEach((token) => assert(html.includes(token), `Missing shared presentation token ${token}`));

[
  '--bg: #efeae1;',
  '--panel: #f7f3eb;',
  '--surface-raised: #fcfaf6;',
  '--line: #d8d2c8;',
  '--soft: #fbf8f2;'
].forEach((token) => assert(html.includes(token), `Missing warm light-theme surface token ${token}`));

assert(/body\[data-theme="dark"\]\s*\{[\s\S]*?--panel:\s*#182231;[\s\S]*?--surface-raised:\s*#111822;/.test(html), 'Dark-theme surfaces must remain explicitly dark');
assert(/select, input\s*\{[\s\S]*?background:\s*var\(--surface-raised\);/.test(html), 'Inputs must stay distinct on the warm panel surface');
assert(/body::after\s*\{[\s\S]*?paper-grain\.svg[\s\S]*?mix-blend-mode:\s*multiply;/.test(html), 'Light theme must include the shared paper grain overlay');
assert(/body::after\s*\{[\s\S]*?z-index:\s*0;[\s\S]*?pointer-events:\s*none;/.test(html), 'Paper grain must remain behind interactive content');
assert(/body\[data-theme="dark"\]::after,[\s\S]*?body\[data-theme="neo"\]::after\s*\{[\s\S]*?display:\s*none;/.test(html), 'Paper grain must stay disabled in dark themes');
assert(/body:not\(\[data-theme\]\)\s+:where\([\s\S]*?body\[data-theme="light"\]\s+:where\([\s\S]*?\.home-tool-card,[\s\S]*?\.manual-panel,[\s\S]*?\.compendium-stage,[\s\S]*?\.team-slot,[\s\S]*?background-image:\s*url\("assets\/paper-grain\.svg"\);/.test(html), 'Default and explicit light-theme surfaces must render grain behind their content');

assert(/\.pokemon-suggestions\s*\{[\s\S]*?overscroll-behavior:\s*contain;[\s\S]*?scrollbar-gutter:\s*stable;/.test(html), 'Pokémon picker results must keep scrolling contained and stable');
assert(/\.manual-switch-candidates\s*\{[^}]*overscroll-behavior:\s*contain;[^}]*scrollbar-gutter:\s*stable;/.test(html), 'Switch picker must use the shared scroll behavior');
assert(/\.manual-bring-next-candidate\[aria-selected="true"\]::after\s*\{[^}]*content:\s*"✓";/.test(html), 'Replacement picker needs a non-color selected indicator');
assert(/:where\(button, input, select, textarea, \[tabindex\]\):focus-visible/.test(html), 'Shared controls need a consistent keyboard focus treatment');
assert(/font-variant-numeric:\s*tabular-nums;/.test(html), 'Changing battle data must use stable numerals');
assert(/@media \(prefers-reduced-motion: reduce\)/.test(html), 'Reduced-motion support must remain present');

console.log('Presentation UI contract tests passed.');

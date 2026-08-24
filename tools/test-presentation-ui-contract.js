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

assert(/\.pokemon-suggestions\s*\{[\s\S]*?overscroll-behavior:\s*contain;[\s\S]*?scrollbar-gutter:\s*stable;/.test(html), 'Pokémon picker results must keep scrolling contained and stable');
assert(/\.manual-switch-candidates\s*\{[^}]*overscroll-behavior:\s*contain;[^}]*scrollbar-gutter:\s*stable;/.test(html), 'Switch picker must use the shared scroll behavior');
assert(/\.manual-bring-next-candidate\[aria-selected="true"\]::after\s*\{[^}]*content:\s*"✓";/.test(html), 'Replacement picker needs a non-color selected indicator');
assert(/:where\(button, input, select, textarea, \[tabindex\]\):focus-visible/.test(html), 'Shared controls need a consistent keyboard focus treatment');
assert(/font-variant-numeric:\s*tabular-nums;/.test(html), 'Changing battle data must use stable numerals');
assert(/@media \(prefers-reduced-motion: reduce\)/.test(html), 'Reduced-motion support must remain present');

console.log('Presentation UI contract tests passed.');

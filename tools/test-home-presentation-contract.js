const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'PogoPvp.html'), 'utf8');
function assert(condition, message) { if (!condition) throw new Error(message); }

assert(/\.home-tool-card\s*\{[\s\S]*?touch-action:\s*manipulation;[\s\S]*?transition:[^}]*var\(--ui-motion-standard\)/.test(html), 'Home cards must use shared feedback timing and reliable tap behavior');
assert(/\.home-tool-card:hover\s*\{[^}]*transform:\s*translateY\(-1px\);/.test(html), 'Desktop hover feedback should stay restrained');
assert(/\.home-tool-card:active\s*\{[^}]*background:\s*color-mix/.test(html), 'Mobile press feedback should remain visible without animation');
assert(/\.home-tool-card:focus-visible\s*\{[^}]*outline:\s*2px solid/.test(html), 'Home navigation cards need a clear keyboard focus');
assert(/@media \(prefers-reduced-motion: reduce\)/.test(html), 'Home interactions must respect reduced motion');

console.log('Home presentation contract tests passed.');

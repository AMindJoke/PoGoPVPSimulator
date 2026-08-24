const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.resolve(__dirname, '..', 'PogoPvp.html'), 'utf8');
function assert(condition, message) { if (!condition) throw new Error(message); }

assert(/#timelineScroll \.timeline-block\.manual-event-focus,[\s\S]*?animation:\s*manual-event-enter/.test(html), 'Focused timeline events need local feedback');
assert(/@keyframes manual-event-enter/.test(html), 'Timeline event feedback animation is missing');
assert(/\.manual-overlay-controls button\s*\{[^}]*background:\s*transparent;[^}]*color:\s*var\(--muted\)/.test(html), 'Undo and Redo should remain visually secondary');
assert(/\.manual-technical-issues\s*\{[\s\S]*?background:\s*color-mix\(in srgb, var\(--soft\)/.test(html), 'Technical Issues needs a secondary surface');
assert(/\.manual-technical-issue-actions button\s*\{[^}]*background:\s*transparent;/.test(html), 'Inactive technical issue actions should not dominate battle actions');
assert(/@media \(prefers-reduced-motion: reduce\)/.test(html), 'Scenario feedback must respect reduced motion');
assert(/body\.manual-mode-active \.manual-runtime-toolbar\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\);/.test(html), 'Mobile Scenario controls must not inherit the desktop toolbar columns');
assert(/body\.manual-mode-active \.manual-history-actions\s*\{[^}]*grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\);/.test(html), 'Undo, Redo and Restart need three stable mobile columns');
assert(/\.manual-editor-actions \.manual-switch-control > button\s*\{[^}]*flex:\s*0 0 80px;[^}]*white-space:\s*nowrap;/.test(html), 'Mobile Switch controls need enough fixed space for their label');

console.log('Scenario presentation contract tests passed.');

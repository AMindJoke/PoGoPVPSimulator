const fs = require("fs");
const path = require("path");
const assert = require("assert");

const html = fs.readFileSync(path.join(__dirname, "..", "PogoPvp.html"), "utf8");

assert.match(html, /--app-visual-viewport-height:\s*100dvh/);
assert.match(html, /--app-keyboard-inset:\s*0px/);
assert.match(html, /@media \(max-width: 900px\)[\s\S]*?input\[type="search"\][\s\S]*?font-size:\s*max\(16px, 1em\)/);
assert.match(html, /\.modal\.open\s*\{[^}]*height:\s*var\(--app-visual-viewport-height/);
assert.match(html, /manual-mobile-bottom-sheet-shell\s*\{[^}]*max-height:\s*calc\(var\(--app-visual-viewport-height/);
assert.match(html, /window\.visualViewport\.addEventListener\("resize", syncMobileViewport/);
assert.match(html, /document\.addEventListener\("focusin", keepFocusedControlVisible\)/);
assert.match(html, /event\.target\.scrollIntoView\(\{ block: "center", inline: "nearest", behavior: "auto" \}\)/);
assert.match(html, /mobileQuery\.matches && keyboardInset > 100/);

console.log("Mobile keyboard resilience contract tests passed.");

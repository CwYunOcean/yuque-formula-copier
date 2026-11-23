const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const escapeText = text => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const escapeAttribute = text => escapeText(text).replaceAll('"', '&quot;');

class Text {
    constructor(text) { this.nodeType = 3; this.textContent = text; this.childNodes = []; }
    get outerHTML() { return escapeText(this.textContent); }
    get nodeName() { return '#text'; }
}

class Element {
    constructor(name) { this.nodeType = 1; this.name = name; this.attrs = {}; this.childNodes = []; }
    setAttribute(name, value) { this.attrs[name] = String(value); }
    getAttribute(name) { return this.attrs[name] ?? null; }
    hasAttribute(name) { return Object.hasOwn(this.attrs, name); }
    appendChild(node) { node.parentNode = this; this.childNodes.push(node); return node; }
    replaceChild(node, oldNode) {
        this.childNodes[this.childNodes.indexOf(oldNode)] = node;
        node.parentNode = this;
    }
    get nodeName() { return this.name.toUpperCase(); }
    get nextElementSibling() {
        if (!this.parentNode) return null;
        const siblings = this.parentNode.childNodes;
        return siblings.slice(siblings.indexOf(this) + 1).find(node => node.nodeType === 1) ?? null;
    }
    replaceWith(node) {
        const siblings = this.parentNode.childNodes;
        siblings[siblings.indexOf(this)] = node;
        node.parentNode = this.parentNode;
    }
    get textContent() { return this.childNodes.map(node => node.textContent).join(''); }
    set textContent(text) { this.childNodes = []; this.appendChild(new Text(text)); }
    get innerHTML() { return this.childNodes.map(node => node.outerHTML).join(''); }
    get outerHTML() {
        const attrs = Object.entries(this.attrs).map(([key, value]) => ` ${key}="${escapeAttribute(value)}"`).join('');
        const open = `<${this.name}${attrs}>`;
        return this.name === 'br' ? open : open + this.innerHTML + `</${this.name}>`;
    }
    querySelectorAll(selector) {
        const matches = node => selector.startsWith('.')
            ? (node.attrs.class ?? '').split(' ').includes(selector.slice(1))
            : selector.includes('[')
                ? node.name === 'annotation' && node.attrs.encoding === 'application/x-tex'
                : node.name === selector;
        const results = [];
        for (const child of this.childNodes) {
            if (child.nodeType !== 1) continue;
            if (matches(child)) results.push(child);
            results.push(...child.querySelectorAll(selector));
        }
        return results;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] ?? null; }
}

const listeners = {};
const document = {
    createElement: name => new Element(name),
    createTextNode: text => new Text(text),
    addEventListener: (type, handler) => { listeners[type] = handler; },
};
const mathJax = { startup: { document: { getMathItemsWithin: target => [{ math: target.tex }] } } };
const context = vm.createContext({
    document,
    Node: { TEXT_NODE: 3, ELEMENT_NODE: 1 },
    window: { location: { hostname: 'www.zhihu.com' }, getSelection: () => ({ rangeCount: 0 }), MathJax: mathJax },
    MathJax: mathJax,
});
const source = fs.readFileSync(path.join(__dirname, '..', 'FormulaCopier.user.js'), 'utf8');
vm.runInContext(source.replace(/\}\)\(\);\s*$/, `globalThis.api = {
    replaceZhihuFormulas, replaceWikipediaFormulas, replaceChatGPTFormulas,
    replaceOpenReviewFormulas, replaceFormula, setClipboardData, convertLineBreaks
};})();`), context);
const api = context.api;

function capture(container) {
    const formats = {};
    let prevented = false;
    api.setClipboardData({
        clipboardData: { setData: (type, value) => { formats[type] = value; } },
        preventDefault: () => { prevented = true; },
    }, container);
    assert.equal(prevented, true);
    return formats;
}

const tex = String.raw`\text{中文 "<&>"} + \frac{1}{1+e^{-x}}`;
for (const [replace, name, className, annotation] of [
    ['replaceZhihuFormulas', 'span', 'ztext-math', false],
    ['replaceWikipediaFormulas', 'span', 'mwe-math-element', true],
    ['replaceChatGPTFormulas', 'span', 'katex', true],
    ['replaceOpenReviewFormulas', 'mjx-container', '', false],
]) {
    const container = new Element('div');
    container.appendChild(new Text('Sigmoid：'));
    const formula = container.appendChild(new Element(name));
    formula.setAttribute('class', className);
    formula.setAttribute('data-tex', tex);
    formula.tex = `  ${tex}  `;
    if (annotation) {
        const node = formula.appendChild(new Element('annotation'));
        node.setAttribute('encoding', 'application/x-tex');
        node.textContent = tex;
    } else {
        formula.appendChild(new Text('rendered math'));
    }
    container.appendChild(new Text('\n优点：输出在(0,1)\n\nTanh。'));
    api[replace](container);
    const formats = capture(container);
    assert.equal(formats['text/plain'], `Sigmoid：$${tex}$\n优点：输出在(0,1)\n\nTanh。`);
    assert.ok(formats['text/html'].includes('<div data-type="math"'));
    assert.ok(formats['text/html'].includes(`data-text="${escapeAttribute(tex)}"`));
    assert.equal((formats['text/html'].match(/<div style="text-indent: 2em">/g) ?? []).length, 3);
    assert.ok(!formats['text/html'].includes('<br>'));
    assert.ok(!formats['text/html'].includes('text-align: center'));
    const value = formats['text/lake'].match(/<card type="inline" name="math" value="([^"]+)"><\/card>/)[1];
    assert.equal(JSON.parse(decodeURIComponent(value.slice(5))).code, tex);
    assert.ok(!formats['text/lake'].includes('rendered math'));
}

const mixed = new Element('div');
const websiteSpan = mixed.appendChild(new Element('span'));
websiteSpan.setAttribute('onclick', 'untrusted()');
websiteSpan.textContent = '售价 $20，a < b & c > d。';
for (const code of ['x^2', String.raw`\tanh(x)`]) {
    mixed.appendChild(new Text('\n'));
    const formula = mixed.appendChild(new Element('span'));
    api.replaceFormula(formula, code);
}
const formats = capture(mixed);
assert.ok(formats['text/html'].includes('售价 $20，a &lt; b &amp; c &gt; d。'));
assert.ok(!formats['text/html'].includes('onclick'));
assert.equal((formats['text/lake'].match(/name="math"/g) ?? []).length, 2);
assert.equal(formats['text/plain'], '售价 $20，a < b & c > d。\n$x^2$\n$\\tanh(x)$');

const advantage = new Element('div');
function addFormula(container, code) {
    const node = container.appendChild(new Element('span'));
    api.replaceFormula(node, code);
}
advantage.appendChild(new Text('优势记为 '));
addFormula(advantage, 'A_i');
advantage.appendChild(new Text('。目标函数：\n\n \t'));
const loss = String.raw`L=-\sum_{i=1}^N A_i \log \pi_\theta(\hat a_i|s_i)`;
addFormula(advantage, loss);
advantage.appendChild(new Text(' \t\n\n公式中的 '));
addFormula(advantage, 'i');
advantage.appendChild(new Text(' 是时间步，'));
addFormula(advantage, 'A_t');
advantage.appendChild(new Text(' 是该步的优势。'));
const advantageFormats = capture(advantage);
assert.equal(advantageFormats['text/plain'], `优势记为 $A_i$。目标函数：\n\n \t$${loss}$ \t\n\n公式中的 $i$ 是时间步，$A_t$ 是该步的优势。`);
for (const type of ['text/html', 'text/lake']) {
    assert.equal((advantageFormats[type].match(/text-align: center/g) ?? []).length, 1);
}
assert.ok(advantageFormats['text/html'].includes(`<div style="text-align: center"><div data-type="math" data-text="${escapeAttribute(loss)}"`));
const centeredLake = advantageFormats['text/lake'].match(/<p style="text-align: center">([\s\S]*?)<\/p>/)[1];
const lossValue = centeredLake.match(/value="([^"]+)"/)[1];
assert.equal(JSON.parse(decodeURIComponent(lossValue.slice(5))).code, loss);
const annotated = new Element('div');
addFormula(annotated, 'x^2');
annotated.appendChild(new Text(' (1)\n'));
addFormula(annotated, 'a');
annotated.appendChild(new Text(' '));
addFormula(annotated, 'b');
assert.ok(!capture(annotated)['text/lake'].includes('text-align: center'));

const paragraphRoot = new Element('div');
const firstParagraph = paragraphRoot.appendChild(new Element('p'));
firstParagraph.appendChild(new Text('目标：'));
firstParagraph.appendChild(new Element('br'));
addFormula(firstParagraph, loss);
const secondParagraph = paragraphRoot.appendChild(new Element('p'));
secondParagraph.appendChild(new Text('解释。'));
const paragraphFormats = capture(paragraphRoot);
assert.equal(paragraphFormats['text/plain'], `目标：\n$${loss}$\n\n解释。`);
assert.equal((paragraphFormats['text/lake'].match(/text-align: center/g) ?? []).length, 1);

listeners.copy({ preventDefault: () => assert.fail('Empty selections must retain browser copy behavior') });
const inspector = fs.readFileSync(path.join(__dirname, '..', 'tools', 'clipboard-check.html'), 'utf8');
const inspectorContext = vm.createContext({ document: { getElementById: () => ({ addEventListener() {} }) } });
vm.runInContext(inspector.match(/<script>([\s\S]*?)<\/script>/)[1], inspectorContext);
const report = inspectorContext.summarizeClipboard({
    types: Object.keys(advantageFormats),
    getData: type => advantageFormats[type] ?? '',
});
assert.equal(report.plain.formulaOnlyLines, 1);
assert.equal(report.html.centeredBlocks, 1);
assert.equal(report.lake.centeredBlocks, 1);
assert.equal(report.html.formulas, 4);
assert.equal(report.lake.formulas, 4);
assert.ok(!JSON.stringify(report).includes(loss));
const textReport = inspectorContext.summarizeClipboard({ types: ['text/plain'], getData: type => type === 'text/plain' ? '$x^2$' : '' });
assert.equal(textReport.plain.formulaOnlyLines, 1);
assert.equal(textReport.html.centeredBlocks, 0);
assert.equal(textReport.lake.characters, 0);

const multiLine = new Element('div');
for (const code of ['x^2', 'y^2', 'z^2', String.raw`\sum_{i=1}^N x_i`]) {
    multiLine.appendChild(new Text('公式：\n\n'));
    addFormula(multiLine, code);
    multiLine.appendChild(new Text('\n\n'));
}
multiLine.appendChild(new Text('正文里的 '));
addFormula(multiLine, 'A_i');
multiLine.appendChild(new Text(' 和 '));
addFormula(multiLine, String.raw`\theta`);
multiLine.appendChild(new Text(' 保持行内。'));
const multiFormats = capture(multiLine);
const multiReport = inspectorContext.summarizeClipboard({ types: Object.keys(multiFormats), getData: type => multiFormats[type] ?? '' });
assert.equal(multiReport.plain.formulaOnlyLines, 4);
assert.equal(multiReport.html.formulas, 6);
assert.equal(multiReport.lake.formulas, 6);
assert.equal(multiReport.html.centeredBlocks, 4);
assert.equal(multiReport.lake.centeredBlocks, 4);

const article = new Element('div');
article.appendChild(new Element('h2')).textContent = '改进探索机制';
const body = article.appendChild(new Element('p'));
body.appendChild(new Text('使用贪心策略，并保留'));
body.appendChild(new Element('b')).textContent = '重点';
body.appendChild(new Text('。'));
const item = article.appendChild(new Element('ul')).appendChild(new Element('li'));
item.appendChild(new Text('以 '));
addFormula(item, String.raw`\epsilon`);
item.appendChild(new Text(' 的概率探索。'));
const equation = String.raw`a=\begin{cases}x&\text{if }y\\z&\text{otherwise}\end{cases}`;
const display = article.appendChild(new Element('div'));
display.setAttribute('class', 'ztext-math');
display.setAttribute('data-tex', equation);
article.appendChild(new Text('\n\n'));
article.appendChild(new Element('h3')).textContent = '经验回放';
article.appendChild(new Element('p')).textContent = '· 保存经验';
article.appendChild(new Element('p')).textContent = '• 抽样训练';
article.appendChild(new Element('p')).textContent = '此处的间隔号 A·B 不变。';
api.replaceZhihuFormulas(article);
const rich = capture(article);
for (const type of ['text/html', 'text/lake']) {
    const markup = rich[type];
    assert.match(markup, /^<h2>改进探索机制<\/h2><(?:p|div) style="text-indent: 2em">使用贪心策略，并保留<strong>重点<\/strong>。/);
    assert.match(markup, /<ul(?: list="[^"]+")?><li>以 .* 的概率探索。<\/li><\/ul><(?:p|div) style="text-align: center">/);
    assert.match(markup, /<h3>经验回放<\/h3><ul(?: list="[^"]+")?><li>保存经验<\/li><li>抽样训练<\/li><\/ul>/);
    assert.equal((markup.match(/text-indent: 2em/g) ?? []).length, 2);
    assert.equal((markup.match(/text-align: center/g) ?? []).length, 1);
    assert.ok(markup.includes('A·B'));
    assert.ok(!markup.includes('<br>'));
}
assert.match(rich['text/lake'], /<\/card><\/p><h3>经验回放/);
const cards = [...rich['text/lake'].matchAll(/value="data:([^"]+)"/g)];
assert.deepEqual(cards.map(card => JSON.parse(decodeURIComponent(card[1])).code), [String.raw`\epsilon`, equation]);
assert.ok(rich['text/plain'].includes('$' + equation + '$'));
assert.ok(rich['text/plain'].includes('· 保存经验'));

const adjacentFormulaParagraph = new Element('p');
addFormula(adjacentFormulaParagraph, String.raw`V^\pi(s)=\mathbb{E}(Q^\pi(s,a))`);
addFormula(adjacentFormulaParagraph, String.raw`Q^\pi(s_t,a_t)=r_t+V^\pi(s_{t+1})`);
const adjacentFormats = capture(adjacentFormulaParagraph);
for (const type of ['text/html', 'text/lake']) {
    const markup = adjacentFormats[type];
    assert.equal((markup.match(/text-align: center/g) ?? []).length, 2);
    assert.equal((markup.match(/name="math"/g) ?? []).length, type === 'text/lake' ? 2 : 0);
    const paragraphTag = type === 'text/lake' ? 'p' : 'div';
    assert.equal((markup.match(new RegExp(`<${paragraphTag} style="text-align: center">`, 'g')) ?? []).length, 2);
    assert.ok(!markup.includes('<br>'));
    assert.ok(!markup.includes('<p><br>'));
}
assert.deepEqual([...adjacentFormats['text/lake'].matchAll(/value="data:([^\"]+)"/g)]
    .map(match => JSON.parse(decodeURIComponent(match[1])).code),
['V^\\pi(s)=\\mathbb{E}(Q^\\pi(s,a))', 'Q^\\pi(s_t,a_t)=r_t+V^\\pi(s_{t+1})']);
console.log('PASS: formula extraction and encoding, headings, bold, first-line indent, native lists, and adjacent standalone equations.');

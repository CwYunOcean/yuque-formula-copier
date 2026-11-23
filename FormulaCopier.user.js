// ==UserScript==
// @name         FormulaCopier
// @namespace    http://tampermonkey.net/
// @version      0.8.1
// @description  粘贴到语雀时保留标题、加粗和列表，独立公式自动居中。
// @author       Yuhang Chen, Dramwig; Yuque adaptation: CwYunOcean
// @license      MIT
// @homepageURL  https://github.com/CwYunOcean/yuque-formula-copier
// @supportURL   https://github.com/CwYunOcean/yuque-formula-copier/issues
// @downloadURL  https://raw.githubusercontent.com/CwYunOcean/yuque-formula-copier/main/FormulaCopier.user.js
// @updateURL    https://raw.githubusercontent.com/CwYunOcean/yuque-formula-copier/main/FormulaCopier.user.js
// @match        https://www.zhihu.com/*
// @match        https://zhuanlan.zhihu.com/p/*
// @match        https://*.wikipedia.org/*
// @match        https://openreview.net/*
// @match        https://chatgpt.com/*
// @grant        none
// ==/UserScript==

/*
MIT License

Copyright (c) 2023 Yuhang Chen
Copyright (c) 2026 CwYunOcean

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

(function() {
    'use strict';

    document.addEventListener('copy', function(event) {
        let selectedHtml = getSelectionHtml();

        if (window.location.hostname.includes('zhihu.com')) {
            handleZhihu(selectedHtml, event);
        } else if (window.location.hostname.includes('wikipedia.org')) {
            handleWiki(selectedHtml, event);
        } else if (window.location.hostname.includes('openreview.net')) {
            handleOpenReview(selectedHtml, event);
        } else if (window.location.hostname.includes('chatgpt.com')) {
            handleChatGPT(selectedHtml, event);
        }
    });

    document.addEventListener('selectionchange', function() {
        let formulaSelector = null;

        if (window.location.hostname.includes('zhihu.com')) {
            formulaSelector = '.ztext-math';
        } else if (window.location.hostname.includes('wikipedia.org')) {
            formulaSelector = '.mwe-math-element';
        } else if (window.location.hostname.includes('openreview.net')) {
            formulaSelector = 'mjx-container';
        } else if (window.location.hostname.includes('chatgpt.com')) {
            formulaSelector = '.katex';
        }

        if (!formulaSelector) {
            return;
        }

        const allFormulas = document.querySelectorAll(formulaSelector);
        allFormulas.forEach(removeHighlightStyle);

        const sel = window.getSelection();
        if (!sel.rangeCount) {
            return;
        }

        for (let i = 0; i < sel.rangeCount; i++) {
            const range = sel.getRangeAt(i);
            allFormulas.forEach(formula => {
                if (range.intersectsNode(formula)) {
                    applyHighlightStyle(formula);
                }
            });
        }
    });

    function handleZhihu(selectedHtml, event) {
        if (selectedHtml.includes('data-tex')) {
            const container = document.createElement('div');
            container.innerHTML = selectedHtml;
            replaceZhihuFormulas(container);
            setClipboardData(event, container);
        }
    }

    function handleWiki(selectedHtml, event) {
        if (selectedHtml.includes('mwe-math-element')) {
            const container = document.createElement('div');
            container.innerHTML = selectedHtml;
            replaceWikipediaFormulas(container);
            setClipboardData(event, container);
        }
    }

    function handleOpenReview(selectedHtml, event) {
        if (selectedHtml.includes('mjx-container')) {
            const container = document.createElement('div');
            container.innerHTML = selectedHtml;
            replaceOpenReviewFormulas(container);
            setClipboardData(event, container);
        }
    }

    function handleChatGPT(selectedHtml, event) {
        if (selectedHtml.includes('katex')) {
            const container = document.createElement('div');
            container.innerHTML = selectedHtml;
            replaceChatGPTFormulas(container);
            setClipboardData(event, container);
        }
    }

    function applyHighlightStyle(formula) {
        const mathJaxSVG = formula.querySelector('.MathJax_SVG');
        if (mathJaxSVG && mathJaxSVG.style) {
            mathJaxSVG.style.backgroundColor = 'lightblue';
            return;
        }

        const mathJaxCHTML = formula.querySelector('mjx-math');
        if (mathJaxCHTML && mathJaxCHTML.style) {
            mathJaxCHTML.style.backgroundColor = 'lightblue';
            return;
        }

        const katexHtml = formula.querySelector('.katex-html');
        if (katexHtml && katexHtml.style) {
            katexHtml.style.backgroundColor = 'lightblue';
            return;
        }

        if (formula && formula.style) {
            formula.style.backgroundColor = 'lightblue';
        }
    }

    function removeHighlightStyle(formula) {
        const mathJaxSVG = formula.querySelector('.MathJax_SVG');
        if (mathJaxSVG && mathJaxSVG.style) {
            mathJaxSVG.style.backgroundColor = '';
        }

        const mathJaxCHTML = formula.querySelector('mjx-math');
        if (mathJaxCHTML && mathJaxCHTML.style) {
            mathJaxCHTML.style.backgroundColor = '';
        }

        const katexHtml = formula.querySelector('.katex-html');
        if (katexHtml && katexHtml.style) {
            katexHtml.style.backgroundColor = '';
        }

        if (formula && formula.style) {
            formula.style.backgroundColor = '';
        }
    }

    function getLatexFromMjxContainer(container) {
        if (!window.MathJax?.startup?.document) return null;

        const counter = container.getAttribute('ctxtmenu_counter');
        const target = counter
            ? document.querySelector(`mjx-container[ctxtmenu_counter="${counter}"]`) || container
            : container;

        const mathItems = MathJax.startup.document.getMathItemsWithin(target);
        const math = mathItems[0]?.math;
        return typeof math === 'string' ? math.trim() : null;
    }

    function replaceOpenReviewFormulas(container) {
        container.querySelectorAll('mjx-container').forEach(formula => {
            const texCode = getLatexFromMjxContainer(formula);
            if (texCode) {
                replaceFormula(formula, texCode);
            }
        });
    }

    function replaceWikipediaFormulas(container) {
        const formulas = container.querySelectorAll('.mwe-math-element');
        formulas.forEach(formula => {
            const annotation = formula.querySelector('annotation[encoding="application/x-tex"]');
            if (annotation) {
                const texCode = annotation.textContent;
                replaceFormula(formula, texCode);
            }
        });
    }

    function replaceChatGPTFormulas(container) {
        container.querySelectorAll('.katex').forEach(formula => {
            const annotation = formula.querySelector('annotation[encoding="application/x-tex"]');
            if (annotation) {
                const texCode = annotation.textContent.trim();
                replaceFormula(formula, texCode);
            }
        });
    }

    function replaceZhihuFormulas(container) {
        const formulas = container.querySelectorAll('.ztext-math');
        formulas.forEach(formula => {
            const texCode = formula.getAttribute('data-tex');
            replaceFormula(formula, texCode);
        });
    }

    function replaceFormula(formula, texCode) {
        const span = document.createElement('span');
        span.setAttribute('data-formula-copier', texCode);
        if (formula.nodeName === 'DIV' || formula.style?.display === 'block' ||
            /^(true|block)$/.test(formula.getAttribute('display')) ||
            formula.parentElement?.classList.contains('katex-display')) {
            span.setAttribute('data-formula-display', '');
        }
        span.textContent = '$' + texCode + '$';
        formula.replaceWith(span);
    }

    function collectBlocks(container) {
        const blocks = [];
        let parts = [];

        function endBlock(block) {
            if (parts.some(part => part.text.trim())) blocks.push({ ...block, parts });
            parts = [];
        }

        function walk(node, block, bold) {
            if (node.nodeType === Node.TEXT_NODE) {
                node.textContent.split('\n').forEach((text, index) => {
                    if (index) endBlock(block);
                    if (text) parts.push({ text, bold });
                });
                return;
            }
            if (node.nodeType !== Node.ELEMENT_NODE) return;

            if (node.hasAttribute('data-formula-copier')) {
                const formula = { text: node.textContent, code: node.getAttribute('data-formula-copier') };
                if (node.hasAttribute('data-formula-display')) {
                    endBlock(block);
                    blocks.push({ tag: 'p', parts: [formula] });
                } else {
                    parts.push(formula);
                }
                return;
            }

            const tag = node.nodeName.toLowerCase();
            if (tag === 'br') {
                endBlock(block);
                return;
            }

            const heading = /^h[1-6]$/.test(tag);
            const boundary = heading || ['p', 'div', 'section', 'figure', 'ul', 'ol', 'li'].includes(tag);
            if (boundary) endBlock(block);
            const next = tag === 'ul' || tag === 'ol' ? { tag: 'p', list: node, listTag: tag } :
                tag === 'li' && !block.list ? { tag: 'p', list: node, listTag: 'ul' } :
                    heading ? { ...block, tag } : block;
            const weight = node.style?.fontWeight;
            node.childNodes.forEach(child => walk(child, next,
                bold || tag === 'strong' || tag === 'b' || weight === 'bold' || Number(weight) >= 600));
            if (boundary) endBlock(next);
        }

        const paragraph = { tag: 'p' };
        container.childNodes.forEach(node => walk(node, paragraph, false));
        endBlock(paragraph);
        return blocks;
    }

    function serializeBlocks(blocks, lake) {
        const root = document.createElement('div');
        let list = null;
        let listKey = null;
        let listId = 0;
        for (const { tag, parts, list: sourceList, listTag } of blocks) {
            const content = parts.filter(part => part.text.trim());
            const first = content[0];
            const bullet = tag === 'p' && first.code === undefined && /^\s*[·•]/.test(first.text);
            const key = sourceList || (bullet ? 'bullet' : null);
            if (!key) list = null;
            else if (!list || key !== listKey) {
                list = document.createElement(listTag || 'ul');
                // Lake requires a list ID even for a single bullet.
                if (lake) list.setAttribute('list', 'formula-copier-' + ++listId);
                const start = sourceList?.getAttribute('start');
                if (listTag === 'ol' && start && /^\d+$/.test(start)) list.setAttribute('start', start);
                root.appendChild(list);
            }
            listKey = key;

            const centered = !list && tag === 'p' && content.length === 1 && first.code !== undefined;
            const adjacentEquations = !list && tag === 'p' && content.length > 1 &&
                content.every(part => part.code !== undefined) && parts.length === content.length;

            for (const standalonePart of adjacentEquations ? content : [null]) {
                const element = document.createElement(list ? 'li' : !lake && tag === 'p' ? 'div' : tag);
                if (centered || adjacentEquations) element.setAttribute('style', 'text-align: center');
                else if (!list && tag === 'p' && content.some(part => !part.bold)) {
                    element.setAttribute('style', 'text-indent: 2em');
                }

                for (const part of standalonePart ? [standalonePart] : centered ? content : parts) {
                    if (part.code !== undefined) {
                        const formula = document.createElement(lake ? 'card' : 'div');
                        if (lake) {
                            formula.setAttribute('type', 'inline');
                            formula.setAttribute('name', 'math');
                            formula.setAttribute('value', 'data:' + encodeURIComponent(JSON.stringify({ code: part.code })));
                        } else {
                            formula.setAttribute('data-type', 'math');
                            formula.setAttribute('data-text', part.code);
                            formula.setAttribute('style', 'display: inline');
                            formula.textContent = part.text;
                        }
                        element.appendChild(formula);
                    } else {
                        const text = bullet && part === first ? part.text.replace(/^\s*[·•][ \t\u00a0\u3000]*/, '') : part.text;
                        if (!text) continue;
                        const parent = part.bold ? element.appendChild(document.createElement('strong')) : element;
                        parent.appendChild(document.createTextNode(text));
                    }
                }
                (list || root).appendChild(element);
            }
        }
        return root.innerHTML;
    }

    function setClipboardData(event, container) {
        // Build our own markup; never forward source HTML or its attributes.
        const blocks = collectBlocks(container);
        convertLineBreaks(container);
        event.clipboardData.setData('text/plain', container.textContent);
        event.clipboardData.setData('text/html', serializeBlocks(blocks, false));
        // shortcut: Yuque's current clipboard formats, update the markers if its editor changes.
        event.clipboardData.setData('text/lake', serializeBlocks(blocks, true));
        event.preventDefault();
    }

    function convertLineBreaks(node) {
        if (node.nodeName === 'BR') {
            node.parentNode.replaceChild(document.createTextNode('\n'), node);
        } else {
            const children = Array.from(node.childNodes);
            for (let child of children) {
                convertLineBreaks(child);
            }
            if (node.nodeName === 'P' && node.nextElementSibling) {
                node.appendChild(document.createTextNode('\n\n'));
            }
        }
    }

    function getSelectionHtml() {
        const sel = window.getSelection();
        if (sel.rangeCount) {
            const container = document.createElement('div');
            for (let i = 0, len = sel.rangeCount; i < len; ++i) {
                container.appendChild(sel.getRangeAt(i).cloneContents());
            }

            return container.innerHTML;
        }
        return '';
    }
})();

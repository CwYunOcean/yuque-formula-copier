// ==UserScript==
// @name         FormulaCopier
// @namespace    http://tampermonkey.net/
// @version      0.7.0
// @description  复制网页公式的 LaTeX，粘贴到语雀时生成可编辑公式，独立公式自动居中。
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
        span.textContent = '$' + texCode + '$';
        formula.replaceWith(span);
    }

    function setClipboardData(event, container) {
        const html = [document.createElement('div')];
        const lake = [document.createElement('p')];

        function appendContent(node) {
            if (node.nodeType === Node.TEXT_NODE) {
                node.textContent.split('\n').forEach((line, index) => {
                    if (index) {
                        html.push(document.createElement('div'));
                        lake.push(document.createElement('p'));
                    }
                    html.at(-1).appendChild(document.createTextNode(line));
                    lake.at(-1).appendChild(document.createTextNode(line));
                });
            } else if (node.nodeType === Node.ELEMENT_NODE && node.hasAttribute('data-formula-copier')) {
                const code = node.getAttribute('data-formula-copier');
                const math = document.createElement('div');
                math.setAttribute('data-type', 'math');
                math.setAttribute('data-text', code);
                math.setAttribute('style', 'display: inline');
                math.textContent = node.textContent;
                html.at(-1).appendChild(math);

                const card = document.createElement('card');
                card.setAttribute('type', 'inline');
                card.setAttribute('name', 'math');
                card.setAttribute('value', 'data:' + encodeURIComponent(JSON.stringify({ code })));
                lake.at(-1).appendChild(card);
            } else {
                node.childNodes.forEach(appendContent);
            }
        }

        // Emit only text and formula nodes; never forward website HTML or event attributes.
        appendContent(container);
        html.forEach((line, index) => {
            const content = Array.from(line.childNodes).filter(node => node.textContent.trim());
            if (content.length === 1 && content[0].nodeType === Node.ELEMENT_NODE) {
                line.setAttribute('style', 'text-align: center');
                lake[index].setAttribute('style', 'text-align: center');
            } else if (!content.length) {
                line.appendChild(document.createElement('br'));
                lake[index].appendChild(document.createElement('br'));
            }
        });
        event.clipboardData.setData('text/plain', container.textContent);
        event.clipboardData.setData('text/html', html.map(line => line.outerHTML).join(''));
        // shortcut: Yuque's current clipboard formats, update these markers if its editor changes.
        event.clipboardData.setData('text/lake', lake.map(line => line.outerHTML).join(''));
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

            // Keep newline
            convertLineBreaks(container);
            return container.innerHTML;
        }
        return '';
    }
})();

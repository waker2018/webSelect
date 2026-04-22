import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 生成 Webview 内容
 * 核心思路：将原 HTML 的外部 CSS/JS 资源内联，然后直接渲染
 */
export function generateWebviewContent(
    htmlContent: string,
    baseUri: vscode.Uri,
    cspSource: string,
    documentPath?: string
): string {
    let processedHtml = htmlContent;

    // 如果提供了文档路径，尝试内联 CSS
    if (documentPath) {
        const docDir = path.dirname(documentPath);
        processedHtml = inlineExternalStyles(processedHtml, docDir);
    }

    // 准备注入的选择器脚本和样式
    const selectorStyles = `
<style id="ag-selector-styles">
    .ag-element-hover {
        outline: 2px solid #00d4ff !important;
        outline-offset: 2px;
        cursor: pointer !important;
        box-shadow: 0 0 0 4px rgba(0, 212, 255, 0.2) !important;
    }
    .ag-element-selected {
        outline: 3px solid #ff4757 !important;
        outline-offset: 2px;
        box-shadow: 0 0 0 6px rgba(255, 71, 87, 0.3) !important;
    }
    .ag-tooltip {
        position: fixed;
        background: rgba(17, 24, 32, 0.95);
        color: #00d4ff;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 11px;
        font-family: 'Courier New', monospace;
        pointer-events: none;
        z-index: 999999;
        border: 1px solid #00d4ff;
        max-width: 300px;
    }
    #ag-toolbar {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        right: 0 !important;
        height: 45px !important;
        background: #1e1e1e !important;
        border-bottom: 1px solid #333 !important;
        padding: 8px 12px !important;
        display: flex !important;
        gap: 10px !important;
        align-items: center !important;
        z-index: 999999 !important;
        box-shadow: 0 2px 5px rgba(0,0,0,0.3) !important;
    }
    #ag-toolbar button {
        background: #0e639c !important;
        color: #fff !important;
        border: none !important;
        padding: 6px 12px !important;
        border-radius: 4px !important;
        cursor: pointer !important;
        font-size: 12px !important;
        font-family: sans-serif !important;
    }
    #ag-toolbar button:hover { opacity: 0.9; }
    #ag-toolbar button.active { background: #00d4ff !important; color: #000 !important; }
    #ag-toolbar span { color: #888 !important; font-size: 12px !important; font-family: sans-serif !important; }
    body { padding-top: 50px !important; }
    #ag-popup {
        position: fixed;
        background: #1e1e1e;
        border: 1px solid #00d4ff;
        border-radius: 6px;
        padding: 12px;
        z-index: 9999999;
        width: 280px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.6);
        font-family: sans-serif;
    }
    #ag-popup-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    #ag-popup-tag { color: #00d4ff; font-size: 12px; font-weight: bold; font-family: monospace; }
    #ag-popup-close { background: none !important; border: none !important; color: #666 !important; cursor: pointer !important; font-size: 14px !important; padding: 2px 4px !important; line-height: 1 !important; }
    #ag-popup-close:hover { color: #fff !important; }
    #ag-popup-selector { color: #888; font-size: 10px; font-family: monospace; margin-bottom: 8px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    #ag-popup-input { width: 100%; box-sizing: border-box; background: #2d2d2d; border: 1px solid #444; color: #fff; border-radius: 4px; padding: 6px 8px; font-size: 12px; font-family: sans-serif; resize: vertical; min-height: 54px; margin-bottom: 8px; outline: none; display: block; }
    #ag-popup-input:focus { border-color: #00d4ff; }
    #ag-popup-submit { background: #0e639c !important; color: #fff !important; border: none !important; padding: 7px 0 !important; border-radius: 4px !important; cursor: pointer !important; font-size: 12px !important; width: 100% !important; display: block !important; }
    #ag-popup-submit:hover { background: #1177bb !important; }
</style>`;

    const selectorScript = `
<script id="ag-selector-script">
(function() {
    const vscode = acquireVsCodeApi();
    let isActive = false;
    let hoveredElement = null;
    const selectedElements = new Set();
    let tooltip = null;
    let currentPopup = null;

    // 创建工具栏
    const toolbar = document.createElement('div');
    toolbar.id = 'ag-toolbar';
    toolbar.innerHTML = \`
        <button id="ag-toggleBtn">⏸️ 选择模式：关闭</button>
        <button id="ag-clearBtn">🗑️ 清除 (<span id="ag-count">0</span>)</button>
        <span style="margin-left: auto;">Ctrl+点击快速选中 &nbsp;|&nbsp; 开启选择模式后点击选中</span>
    \`;
    document.body.insertBefore(toolbar, document.body.firstChild);

    document.getElementById('ag-toggleBtn').addEventListener('click', function() {
        isActive = !isActive;
        this.classList.toggle('active', isActive);
        this.textContent = isActive ? '🎯 选择模式：开启' : '⏸️ 选择模式：关闭';
        if (!isActive) {
            hideTooltip();
            document.body.style.cursor = '';
        } else {
            document.body.style.cursor = 'crosshair';
        }
    });

    document.getElementById('ag-clearBtn').addEventListener('click', function() {
        selectedElements.clear();
        document.querySelectorAll('.ag-element-selected').forEach(el => el.classList.remove('ag-element-selected'));
        updateCount();
        vscode.postMessage({ type: 'clearSelection' });
    });

    function updateCount() {
        document.getElementById('ag-count').textContent = selectedElements.size;
    }

    function showTooltip(element, x, y) {
        hideTooltip();
        tooltip = document.createElement('div');
        tooltip.className = 'ag-tooltip';
        const classes = Array.from(element.classList).filter(c => !c.startsWith('ag-')).join(' ');
        tooltip.innerHTML = '<div><strong>' + element.tagName.toLowerCase() + '</strong></div>' +
            (classes ? '<div style="font-size:10px;opacity:0.8;">class: ' + classes + '</div>' : '');
        tooltip.style.left = (x + 10) + 'px';
        tooltip.style.top = (y + 10) + 'px';
        document.body.appendChild(tooltip);
    }

    function hideTooltip() {
        if (tooltip) { tooltip.remove(); tooltip = null; }
    }

    function assignId(el) {
        if (!el.dataset.agId) {
            el.dataset.agId = 'ag-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        }
        return el.dataset.agId;
    }

    function extractInfo(el, id) {
        const cs = window.getComputedStyle(el);
        return {
            id: id,
            selector: el.id ? '#' + el.id : getPath(el),
            xpath: getXPath(el),
            tag: el.tagName.toLowerCase(),
            classes: Array.from(el.classList).filter(c => !c.startsWith('ag-')),
            text: (el.innerText || '').substring(0, 100),
            html: el.innerHTML.substring(0, 200),
            styles: {
                color: cs.color,
                backgroundColor: cs.backgroundColor,
                fontSize: cs.fontSize,
                fontWeight: cs.fontWeight,
                padding: cs.padding,
                margin: cs.margin,
                display: cs.display
            },
            position: { line: null },
            attributes: getAttrs(el)
        };
    }

    function getPath(el) {
        const path = [];
        let cur = el;
        while (cur && cur.parentElement && cur !== document.body) {
            let sel = cur.tagName.toLowerCase();
            const cls = Array.from(cur.classList).filter(c => !c.startsWith('ag-'));
            if (cls.length) sel += '.' + cls.join('.');
            path.unshift(sel);
            cur = cur.parentElement;
        }
        return path.join(' > ');
    }

    function getXPath(el) {
        if (el.id) return '//*[@id="' + el.id + '"]';
        const path = [];
        let cur = el;
        while (cur && cur.parentElement) {
            let idx = 1, sib = cur.previousSibling;
            while (sib) { if (sib.nodeType === 1 && sib.tagName === cur.tagName) idx++; sib = sib.previousSibling; }
            path.unshift(cur.tagName.toLowerCase() + '[' + idx + ']');
            cur = cur.parentElement;
        }
        return '/' + path.join('/');
    }

    function getAttrs(el) {
        const a = {};
        for (const attr of el.attributes) { if (!attr.name.startsWith('data-ag-')) a[attr.name] = attr.value; }
        return a;
    }

    function showPopup(el, info) {
        hidePopup();
        const rect = el.getBoundingClientRect();
        const popup = document.createElement('div');
        popup.id = 'ag-popup';
        const selectorText = info.selector.length > 38 ? info.selector.substring(0, 38) + '\u2026' : info.selector;
        popup.innerHTML =
            '<div id="ag-popup-header">' +
                '<span id="ag-popup-tag">&lt;' + info.tag + '&gt;</span>' +
                '<button id="ag-popup-close">\u2715</button>' +
            '</div>' +
            '<div id="ag-popup-selector">' + selectorText + '</div>' +
            '<textarea id="ag-popup-input" placeholder="\u63cf\u8ff0\u4fee\u6539\u9700\u6c42\uff0c\u4f8b\u5982\uff1a\u6539\u6210\u7ea2\u8272\u3001\u5b57\u53f7\u52a0\u5927\u2026 (Ctrl+Enter \u53d1\u9001)"></textarea>' +
            '<button id="ag-popup-submit">\u2728 AI \u4fee\u6539</button>';
        document.body.appendChild(popup);
        // 定位到元素旁边
        var pw = 284, ph = 185, margin = 10;
        var left = rect.right + margin;
        var top = rect.top;
        if (left + pw > window.innerWidth - margin) left = rect.left - pw - margin;
        if (left < margin) left = Math.max(margin, Math.min(rect.left, window.innerWidth - pw - margin));
        if (top + ph > window.innerHeight - margin) top = Math.max(margin, window.innerHeight - ph - margin);
        if (top < margin) top = margin;
        popup.style.left = left + 'px';
        popup.style.top = top + 'px';
        currentPopup = popup;
        document.getElementById('ag-popup-close').addEventListener('click', function(e) {
            e.stopPropagation();
            hidePopup();
        });
        document.getElementById('ag-popup-submit').addEventListener('click', function(e) {
            e.stopPropagation();
            var instruction = document.getElementById('ag-popup-input').value.trim();
            if (!instruction) { document.getElementById('ag-popup-input').focus(); return; }
            vscode.postMessage({ type: 'aiModifyRequest', data: info, instruction: instruction });
            hidePopup();
        });
        document.getElementById('ag-popup-input').addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                e.stopPropagation();
                document.getElementById('ag-popup-submit').click();
            }
            e.stopPropagation();
        });
        setTimeout(function() { var inp = document.getElementById('ag-popup-input'); if (inp) inp.focus(); }, 50);
    }

    function hidePopup() {
        if (currentPopup) { currentPopup.remove(); currentPopup = null; }
    }

    document.addEventListener('mousemove', function(e) {
        const ctrlHeld = e.ctrlKey || e.metaKey;
        if (!isActive && !ctrlHeld) {
            if (hoveredElement && !selectedElements.has(hoveredElement)) {
                hoveredElement.classList.remove('ag-element-hover');
                hoveredElement = null;
            }
            hideTooltip();
            return;
        }
        const el = e.target;
        if (el.id && el.id.startsWith('ag-')) return; // 忽略工具栏
        if (el.closest('#ag-toolbar')) return;
        if (el === hoveredElement) return;
        if (hoveredElement && !selectedElements.has(hoveredElement)) {
            hoveredElement.classList.remove('ag-element-hover');
        }
        if (!el.classList.contains('ag-element-selected')) {
            el.classList.add('ag-element-hover');
        }
        hoveredElement = el;
        showTooltip(el, e.clientX, e.clientY);
    });

    document.addEventListener('click', function(e) {
        const el = e.target;
        if (el.id && el.id.startsWith('ag-')) return;
        if (el.closest('#ag-toolbar')) return;
        if (!isActive && !e.ctrlKey && !e.metaKey) return;
        e.preventDefault();
        e.stopPropagation();
        const id = assignId(el);
        const info = extractInfo(el, id);
        el.classList.add('ag-element-selected');
        el.classList.remove('ag-element-hover');
        selectedElements.add(el);
        updateCount();
        vscode.postMessage({ type: 'elementSelected', data: info });
        showPopup(el, info);
    }, true);

    // 初始化
    document.body.style.cursor = '';
    vscode.postMessage({ type: 'log', message: '元素选择器已初始化（交互模式）' });
})();
</script>`;

    // 注入样式和脚本到 HTML
    // 在 </head> 前注入样式
    const headCloseIndex = processedHtml.indexOf('</head>');
    if (headCloseIndex !== -1) {
        processedHtml = processedHtml.substring(0, headCloseIndex) + selectorStyles + processedHtml.substring(headCloseIndex);
    } else {
        // 如果没有 </head>，在开头添加
        processedHtml = selectorStyles + processedHtml;
    }

    // 在 </body> 前注入脚本
    const bodyCloseIndex = processedHtml.lastIndexOf('</body>');
    if (bodyCloseIndex !== -1) {
        processedHtml = processedHtml.substring(0, bodyCloseIndex) + selectorScript + processedHtml.substring(bodyCloseIndex);
    } else {
        processedHtml += selectorScript;
    }

    return processedHtml;
}

/**
 * 将外部 CSS 文件内容内联到 HTML 中
 */
function inlineExternalStyles(html: string, docDir: string): string {
    // 匹配 <link rel="stylesheet" href="...">
    const linkRegex = /<link[^>]+rel=["']?stylesheet["']?[^>]+href=["']?([^"'\s>]+)["']?[^>]*>/gi;

    return html.replace(linkRegex, (match, href) => {
        // 跳过外部 URL (http/https)
        if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//')) {
            // 保留外部链接，但可能无法加载
            return match;
        }

        // 解析本地路径
        const cssPath = path.resolve(docDir, href);

        try {
            if (fs.existsSync(cssPath)) {
                const cssContent = fs.readFileSync(cssPath, 'utf-8');
                console.log(`[CSS Inlined] ${cssPath}`);
                return `<style>/* Inlined from ${href} */\n${cssContent}</style>`;
            } else {
                console.log(`[CSS Not Found] ${cssPath}`);
                return `<!-- CSS file not found: ${href} -->`;
            }
        } catch (e) {
            console.error(`[CSS Error] ${cssPath}:`, e);
            return `<!-- Failed to inline CSS: ${href} -->`;
        }
    });
}

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { generateWebviewContent } from './webviewContent';

interface ElementInfo {
    id: string;
    selector: string;
    xpath: string;
    tag: string;
    classes: string[];
    text: string;
    html: string;
    styles: Record<string, string>;
    position: {
        line?: number;
    };
    attributes: Record<string, string>;
}

let selectedElements: ElementInfo[] = [];
let previewPanel: vscode.WebviewPanel | undefined;

export function activate(context: vscode.ExtensionContext) {
    console.log('Antigravity Element Selector 已激活');

    // 注册命令：启动元素选择
    const startCommand = vscode.commands.registerCommand(
        'elementSelector.start',
        () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.languageId !== 'html') {
                vscode.window.showWarningMessage('请先打开一个 HTML 文件');
                return;
            }

            openPreviewPanel(context, editor.document);
        }
    );

    // 注册命令：打开预览
    const openPreviewCommand = vscode.commands.registerCommand(
        'elementSelector.openPreview',
        () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.document.languageId !== 'html') {
                vscode.window.showWarningMessage('请先打开一个 HTML 文件');
                return;
            }

            openPreviewPanel(context, editor.document);
        }
    );

    // 注册命令：清除选择
    const clearSelectionCommand = vscode.commands.registerCommand(
        'elementSelector.clearSelection',
        () => {
            selectedElements = [];
            vscode.window.showInformationMessage('已清除所有选择');

            if (previewPanel) {
                previewPanel.webview.postMessage({ type: 'clearSelection' });
            }
        }
    );

    context.subscriptions.push(startCommand, openPreviewCommand, clearSelectionCommand);
}

function openPreviewPanel(
    context: vscode.ExtensionContext,
    document: vscode.TextDocument
) {
    const column = vscode.ViewColumn.Beside;

    if (previewPanel) {
        previewPanel.reveal(column);
    } else {
        previewPanel = vscode.window.createWebviewPanel(
            'htmlElementPreview',
            '🎯 元素选择器',
            column,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.file(path.join(context.extensionPath, 'src', 'webview'))
                ]
            }
        );

        // 设置图标
        previewPanel.iconPath = vscode.Uri.parse('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="%2300d4ff"/></svg>');

        // 监听 Webview 消息
        previewPanel.webview.onDidReceiveMessage(
            message => {
                switch (message.type) {
                    case 'elementSelected':
                        handleElementSelected(message.data);
                        break;
                    case 'aiModifyRequest':
                        handleAiModifyRequest(message.data, message.instruction, document);
                        break;
                    case 'clearSelection':
                        // Webview 请求清除，Extension 同步清除
                        selectedElements = [];
                        vscode.window.showInformationMessage('已清除所有选择');
                        break;
                    case 'log':
                        console.log('[Webview]', message.message);
                        break;
                    case 'error':
                        console.error('[Webview Error]', message.message);
                        vscode.window.showErrorMessage(`Webview 错误: ${message.message}`);
                        break;
                }
            },
            undefined,
            context.subscriptions
        );

        previewPanel.onDidDispose(
            () => {
                previewPanel = undefined;
                selectedElements = [];
            },
            null,
            context.subscriptions
        );
    }

    // 设置 Webview 内容
    previewPanel.webview.html = getWebviewContent(
        context,
        previewPanel.webview,
        document
    );

    // 激活选择模式
    setTimeout(() => {
        if (previewPanel) {
            previewPanel.webview.postMessage({ type: 'activate' });
        }
    }, 500);
}

function handleElementSelected(elementInfo: ElementInfo) {
    selectedElements.push(elementInfo);
    console.log(`[Element Selector] 选中元素 ${selectedElements.length}: ${elementInfo.selector}`);
}

async function handleAiModifyRequest(elementInfo: ElementInfo, instruction: string, document: vscode.TextDocument) {
    // 确保当前元素已在列表中（可能 elementSelected 已提前添加）
    if (!selectedElements.find(e => e.id === elementInfo.id)) {
        selectedElements.push(elementInfo);
    }

    const elementsContext = selectedElements.map((el, idx) => `
### 元素 ${idx + 1}
- 标签: <${el.tag}>
- 选择器: \`${el.selector}\`
- 当前文本: "${el.text || ''}"
- 当前位置: 约第 ${el.position.line || '未知'} 行
- ID: ${el.id}
`.trim()).join('\n\n');

    const prompt = `
我需要你直接修改当前打开的文件 (${document.fileName})。

## 任务目标
${instruction}

## 待修改元素上下文
我已在预览窗口中选中了以下元素，请根据这些信息定位到源代码中的对应位置，并应用修改：

${elementsContext}

## 执行要求
1. **直接修改代码**：不要返回 JSON，不要只给建议，直接对源代码进行编辑。
2. **精确定位**：利用提供的选择器和文本内容定位代码。
3. **最小修改**：只修改涉及的属性或样式，保持其他代码不变。
    `.trim();

    await tryOpenAIChat(prompt);
}

async function tryOpenAIChat(prompt: string) {
    // 1. 确保内容在剪贴板 (作为最后的防线)
    await vscode.env.clipboard.writeText(prompt);

    // 2. 聚焦编辑器 (Inline Chat 需要编辑器焦点)
    const editor = vscode.window.activeTextEditor;
    if (editor) {
        await vscode.window.showTextDocument(editor.document);

        // 尝试使用 Inline Chat (Antigravity 'Command' Mode)
        try {
            console.log('Trying inlineChat.start...');
            // 尝试标准 Inline Chat 命令，带参数
            // 注意：autoSend 是部分实现的非官方参数，但在某些版本有效
            await vscode.commands.executeCommand('inlineChat.start', {
                message: prompt,
                autoSend: true
            });
            vscode.window.showInformationMessage('✅ 已启动 AI 修改，请在弹出的框中确认或回车');
            return;
        } catch (e) {
            console.log('inlineChat.start failed:', e);
            // 尝试旧版 interactiveEditor
            try {
                await vscode.commands.executeCommand('interactiveEditor.start', {
                    message: prompt,
                    autoSend: true
                });
                return;
            } catch (e2) {
                console.log('interactiveEditor.start failed:', e2);
            }
        }
    }

    // 3. 如果 Inline Chat 失败，回退到 Side Panel Chat
    console.log('Falling back to Side Panel Chat...');
    let opened = false;
    try {
        await vscode.commands.executeCommand('workbench.action.chat.open');
        opened = true;
    } catch (e) {
        console.log('Failed to open standard chat:', e);
        try {
            await vscode.commands.executeCommand('antigravity.openchat');
            opened = true;
        } catch (e2) {
            console.log('Failed to open antigravity chat:', e2);
        }
    }

    // 4. 提示用户粘贴
    if (opened) {
        vscode.window.showInformationMessage(
            '已打开 AI 面板。由于自动发送受限，请按 Ctrl+V 粘贴指令，然后回车。',
            '知道了'
        );
    } else {
        vscode.window.showWarningMessage(
            '启动 AI 失败。请手动按 Ctrl+I (Inline) 或 Ctrl+L (Panel)，然后粘贴 (Ctrl+V) 指令。',
            '确定'
        );
    }
}


function getWebviewContent(
    context: vscode.ExtensionContext,
    webview: vscode.Webview,
    document: vscode.TextDocument
): string {
    const htmlContent = document.getText();
    const baseUri = webview.asWebviewUri(vscode.Uri.file(path.dirname(document.fileName)));

    // 使用新的 CSS 内联方案生成 Webview 内容
    return generateWebviewContent(htmlContent, baseUri, webview.cspSource, document.fileName);
}

function getInlineWebviewContent(htmlContent: string, baseUri: vscode.Uri, cspSource: string): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' ${cspSource}; script-src 'unsafe-inline' ${cspSource}; img-src ${cspSource} https: data:; font-src ${cspSource};">
    <base href="${baseUri}/">
    <title>HTML 元素选择器</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            background: #fff;
            font-family: var(--vscode-font-family);
            color: var(--vscode-editor-foreground);
        }
        
        #toolbar {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: var(--vscode-editor-background);
            border-bottom: 1px solid var(--vscode-panel-border);
            padding: 10px;
            display: flex;
            gap: 10px;
            align-items: center;
            z-index: 1000;
        }
        
        #toolbar button {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 12px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 12px;
        }
        
        #toolbar button:hover {
            background: var(--vscode-button-hoverBackground);
        }
        
        #toolbar .active {
            background: #00d4ff;
            color: #000;
        }
        
        #preview-content {
            padding-top: 60px;
            min-height: 100vh;
        }
        
        /* 元素高亮样式 */
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
        
        /* 元素信息 Tooltip */
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
    </style>
</head>
<body>
    <div id="toolbar">
        <button id="toggleBtn" class="active">🎯 选择模式：开启</button>
        <button id="clearBtn" style="margin-left: 10px;">🗑️ 清除所有 (<span id="count">0</span>)</button>
        <span style="color: var(--vscode-descriptionForeground); font-size: 12px; margin-left: auto;">
            悬停高亮，点击选中
        </span>
    </div>
    
    <div id="preview-content">${htmlContent}</div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        class ElementSelector {
            constructor() {
                this.hoveredElement = null;
                this.selectedElements = new Set();
                this.isActive = false;
                this.tooltip = null;
            }
            
            activate() {
                this.isActive = true;
                document.addEventListener('mousemove', this.handleMouseMove.bind(this));
                document.addEventListener('click', this.handleClick.bind(this), true);
                document.body.style.cursor = 'crosshair';
                this.updateButton();
                vscode.postMessage({ type: 'log', message: '选择器已激活' });
            }
            
            deactivate() {
                this.isActive = false;
                this.clearHighlights();
                document.removeEventListener('mousemove', this.handleMouseMove);
                document.removeEventListener('click', this.handleClick, true);
                document.body.style.cursor = '';
                this.hideTooltip();
                this.updateButton();
                vscode.postMessage({ type: 'log', message: '选择器已关闭' });
            }
            
            updateButton() {
                const btn = document.getElementById('toggleBtn');
                if (this.isActive) {
                    btn.classList.add('active');
                    btn.textContent = '🎯 选择模式：开启';
                } else {
                    btn.classList.remove('active');
                    btn.textContent = '⏸️ 选择模式：关闭';
                }
            }
            
            handleMouseMove(e) {
                if (!this.isActive) return;
                
                const element = e.target;
                if (element === this.hoveredElement || 
                    element.id === 'toolbar' || 
                    element.closest('#toolbar')) {
                    return;
                }
                
                // 移除旧高亮
                if (this.hoveredElement) {
                    this.hoveredElement.classList.remove('ag-element-hover');
                }
                
                // 添加新高亮
                element.classList.add('ag-element-hover');
                this.hoveredElement = element;
                
                // 显示 tooltip
                this.showTooltip(element, e.clientX, e.clientY);
            }
            
            handleClick(e) {
                if (!this.isActive) return;
                if (e.target.id === 'toolbar' || e.target.closest('#toolbar')) {
                    return;
                }
                
                e.preventDefault();
                e.stopPropagation();
                
                const element = e.target;
                
                // 添加唯一 ID
                const elementId = this.assignElementId(element);
                
                // 提取元素信息
                const elementInfo = this.extractElementInfo(element, elementId);
                
                // 标记为选中
                element.classList.add('ag-element-selected');
                element.classList.remove('ag-element-hover');
                this.selectedElements.add(element);
                this.updateCount();
                
                // 发送到 Extension
                vscode.postMessage({
                    type: 'elementSelected',
                    data: elementInfo
                });
            }
            
            assignElementId(element) {
                if (!element.dataset.agId) {
                    element.dataset.agId = \`ag-\${Date.now()}-\${Math.random().toString(36).substr(2, 9)}\`;
                }
                return element.dataset.agId;
            }
            
            extractElementInfo(element, elementId) {
                const computedStyles = window.getComputedStyle(element);
                const rect = element.getBoundingClientRect();
                
                return {
                    id: elementId,
                    selector: this.getCssSelector(element),
                    xpath: this.getXPath(element),
                    tag: element.tagName.toLowerCase(),
                    classes: Array.from(element.classList).filter(c => !c.startsWith('ag-')),
                    text: element.innerText?.substring(0, 100) || '',
                    html: element.innerHTML.substring(0, 200),
                    styles: {
                        color: computedStyles.color,
                        backgroundColor: computedStyles.backgroundColor,
                        fontSize: computedStyles.fontSize,
                        fontWeight: computedStyles.fontWeight,
                        padding: computedStyles.padding,
                        margin: computedStyles.margin,
                        display: computedStyles.display
                    },
                    position: {
                        line: null  // 待实现：从源码映射行号
                    },
                    attributes: this.getAttributes(element)
                };
            }
            
            getCssSelector(element) {
                if (element.id) return \`#\${element.id}\`;
                
                const path = [];
                let current = element;
                while (current && current.parentElement && current !== document.body) {
                    let selector = current.tagName.toLowerCase();
                    const validClasses = Array.from(current.classList).filter(c => !c.startsWith('ag-'));
                    if (validClasses.length > 0) {
                        selector += '.' + validClasses.join('.');
                    }
                    path.unshift(selector);
                    current = current.parentElement;
                }
                return path.join(' > ');
            }
            
            getXPath(element) {
                if (element.id) return \`//*[@id="\${element.id}"]\`;
                
                const path = [];
                let current = element;
                while (current && current.parentElement) {
                    let index = 1;
                    let sibling = current.previousSibling;
                    while (sibling) {
                        if (sibling.nodeType === 1 && sibling.tagName === current.tagName) {
                            index++;
                        }
                        sibling = sibling.previousSibling;
                    }
                    path.unshift(\`\${current.tagName.toLowerCase()}[\${index}]\`);
                    current = current.parentElement;
                }
                return '/' + path.join('/');
            }
            
            getAttributes(element) {
                const attrs = {};
                for (const attr of element.attributes) {
                    if (!attr.name.startsWith('data-ag-')) {
                        attrs[attr.name] = attr.value;
                    }
                }
                return attrs;
            }
            
            showTooltip(element, x, y) {
                this.hideTooltip();
                
                this.tooltip = document.createElement('div');
                this.tooltip.className = 'ag-tooltip';
                this.tooltip.innerHTML = \`
                    <div><strong>\${element.tagName.toLowerCase()}</strong></div>
                    <div style="font-size: 10px; opacity: 0.8;">
                        \${element.className ? 'class: ' + Array.from(element.classList).filter(c => !c.startsWith('ag-')).join(' ') : ''}
                    </div>
                \`;
                this.tooltip.style.left = (x + 10) + 'px';
                this.tooltip.style.top = (y + 10) + 'px';
                document.body.appendChild(this.tooltip);
            }
            
            hideTooltip() {
                if (this.tooltip) {
                    this.tooltip.remove();
                    this.tooltip = null;
                }
            }
            
            clearHighlights() {
                document.querySelectorAll('.ag-element-hover, .ag-element-selected')
                    .forEach(el => {
                        el.classList.remove('ag-element-hover', 'ag-element-selected');
                    });
            }
            
            clearSelection() {
                this.selectedElements.clear();
                document.querySelectorAll('.ag-element-selected').forEach(el => {
                    el.classList.remove('ag-element-selected');
                });
                this.updateCount();
            }

            updateCount() {
                const countEl = document.getElementById('count');
                if (countEl) {
                    countEl.textContent = this.selectedElements.size;
                }
            }
        }
        
        const selector = new ElementSelector();
        
        // 工具栏按钮
        document.getElementById('toggleBtn').addEventListener('click', () => {
            if (selector.isActive) {
                selector.deactivate();
            } else {
                selector.activate();
            }
        });

        document.getElementById('clearBtn').addEventListener('click', () => {
            selector.clearSelection();
            vscode.postMessage({ type: 'clearSelection' });
        });
        
        // 监听来自 Extension 的消息
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'activate':
                    selector.activate();
                    break;
                case 'deactivate':
                    selector.deactivate();
                    break;
                case 'clearSelection':
                    selector.clearSelection();
                    break;
            }
        });
        
        // 默认激活
        // selector.activate();
    </script>
</body>
</html>`;
}

function escapeHtml(html: string): string {
    return html
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

export function deactivate() {
    if (previewPanel) {
        previewPanel.dispose();
    }
}

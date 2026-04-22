# Antigravity HTML Element Selector & Modifier

为 Google Antigravity IDE 开发的原生插件，允许用户直接选中 HTML 元素并通过 AI 修改。

## 功能特性

### ✅ Phase 1 MVP (当前版本)

- **可视化元素选择**：在预览面板中悬停高亮、点击选中 HTML 元素
- **默认交互模式**：打开预览后可正常与页面交互（展开菜单、点击按钮等），不影响页面原有功能
- **Ctrl+点击快速选中**：按住 `Ctrl` 点击任意元素即可选中，无需切换模式
- **元素旁浮动输入面板**：选中元素后，AI 修改输入框出现在元素附近，直接输入指令
- **详细元素信息**：自动提取选择器、样式、文本、属性等完整信息
- **AI 对话集成**：将元素上下文传递给 Antigravity AI Agent
- **快捷操作**：支持快捷键 `Ctrl+Shift+E` (Mac: `Cmd+Shift+E`)

### 🚧 即将推出

- Phase 2：自动化修改应用（Antigravity Skill）
- Phase 3：批量修改、撤销/重做

## 安装

### 方式 1：从源码安装

```bash
# 克隆或下载项目
cd webSelect

# 安装依赖
npm install

# 编译 TypeScript
npm run compile

# 打包扩展
npm run package

# 在 Antigravity 中安装 .vsix 文件
```

### 方式 2：开发模式

1. 在 Antigravity 中按 `F5` 打开扩展开发主机
2. 将 `webSelect` 文件夹作为扩展项目打开
3. 按 `F5` 启动调试

## 使用方法

### 1. 打开 HTML 文件

在 Antigravity 中打开任意 HTML 文件。

### 2. 启动元素选择器

**方式 A：快捷键**
- 按 `Ctrl+Shift+E` (Mac: `Cmd+Shift+E`)

**方式 B：右键菜单**
- 右键点击编辑器
- 选择"选择 HTML 元素"

**方式 C：命令面板**
- 按 `Ctrl+Shift+P`
- 输入"Element Selector: 选择 HTML 元素"

### 3. 选择元素

预览面板默认为**交互模式**，可正常点击页面（展开下拉菜单、显示隐藏内容等）。

**快速选中（推荐）**：按住 `Ctrl` 点击目标元素，悬停时会显示蓝色高亮框。

**批量选中模式**：点击工具栏"选择模式"按钮开启，此时所有点击均为选中操作。

可连续选中多个元素。

### 4. 使用 AI 修改

选中元素后，元素旁边会弹出一个**浮动输入面板**：
1. 在面板的文本框中输入修改需求，例如：
   - "把标题改成红色"
   - "字号变大一点"
   - "添加圆角边框"
2. 按 `Ctrl+Enter` 或点击"✨ AI 修改"按钮发送
3. AI 会自动定位源代码并应用修改

### 5. 查看元素详情

选中元素后，在"输出"面板中选择"Element Selector"通道，可以查看完整的元素信息 JSON。

## 快捷键

| 快捷键 | Windows/Linux | Mac | 功能 |
|---|---|---|---|
| 启动选择器 | `Ctrl+Shift+E` | `Cmd+Shift+E` | 打开预览面板 |
| 快速选中元素 | `Ctrl+点击` | `Cmd+点击` | 直接选中元素（无需开启选择模式） |
| 发送 AI 指令 | `Ctrl+Enter` | `Cmd+Enter` | 在浮动面板中发送修改指令 |

## 元素信息结构

选中的元素会提取以下信息：

```json
{
  "id": "ag-1234567890-abc",           // 自动生成的唯一 ID
  "selector": "div.header > h1.title",  // CSS Selector
  "xpath": "/html/body/div[1]/h1",      // XPath
  "tag": "h1",                           // 标签名
  "classes": ["title", "main-title"],    // 类名列表
  "text": "Welcome",                     // 文本内容
  "styles": {                            // 计算后的样式
    "color": "rgb(51, 51, 51)",
    "fontSize": "32px",
    "fontWeight": "700"
  },
  "attributes": {                        // 所有属性
    "class": "title main-title",
    "id": "page-title"
  }
}
```

## 开发

### 项目结构

```
webSelect/
├── src/
│   ├── extension.ts          # 扩展主入口
│   └── webviewContent.ts     # Webview 内容生成器
├── out/                      # 编译输出
├── test-web/                 # Web 测试文件
├── package.json              # 扩展配置
├── tsconfig.json             # TypeScript 配置
└── README.md                 # 本文档
```

### 编译

```bash
# 开发模式（监听文件变化）
npm run watch

# 生产编译
npm run compile
```

### 调试

1. **在 VSCode/Antigravity 中打开项目**
   - 打开 `webSelect` 文件夹作为工作区

2. **启动扩展开发主机**
   - 按 `F5`（或选择菜单：运行 > 启动调试）
   - 首次按 `F5` 时，会自动使用项目中的 `.vscode/launch.json` 配置
   - 会自动编译 TypeScript 代码（如果尚未编译）

3. **在新窗口中测试扩展**
   - 启动后会自动打开一个新的 VSCode 窗口（标题显示 `[扩展开发主机]`）
   - 在这个新窗口中，扩展已经被加载
   - 打开任意 HTML 文件，测试扩展功能

**常见问题：**
- 如果按 `F5` 没反应，检查是否正确打开了项目文件夹（不是单个文件）
- 确保 `.vscode/launch.json` 文件存在
- **Mac 用户**：可能需要使用 `Fn+F5`，或在系统偏好设置中启用 F 键作为标准功能键

### 打包

```bash
npm run package
```

会生成 `antigravity-element-selector-1.0.0.vsix` 文件。

## 技术栈

- **TypeScript** 5.3+
- **VS Code Extension API** 1.90+
- **Node.js** 20.x

## 系统要求

- Antigravity IDE 1.14.2+
- Node.js 20.x+
- npm 9.x+

## 常见问题

### Q: 预览面板没有打开？

**A:** 确保当前打开的文件是 HTML 文件（扩展名 `.html`）。

### Q: 选择器没有激活？

**A:** 按住 `Ctrl` 点击元素可直接选中（推荐），或点击工具栏"选择模式"按钮手动开启。

### Q: 想先与页面交互再选元素？

**A:** 默认就是交互模式，直接操作页面即可（如展开菜单显示隐藏内容），然后再用 `Ctrl+点击` 选中目标元素。

### Q: 元素信息无法传递给 AI？

**A:** 
1. 选中元素后会在元素旁显示浮动输入面板
2. 在面板中输入指令后，首先尝试打开 Antigravity Inline Chat 并自动填入
3. 如果失败，会将完整 Prompt 复制到剪贴板
4. 手动粘贴到 AI 对话框中即可

### Q: 如何清除已选择的元素？

**A:** 执行命令"Element Selector: 清除选择"或关闭预览面板。

## 路线图

- [x] **Phase 1 MVP**：元素选择和信息提取
- [ ] **Phase 2**：Antigravity Skill 集成，自动化修改应用
- [ ] **Phase 3**：批量修改、撤销/重做、元素截图
- [ ] **Phase 4**：响应式样式检测、修改历史

## 许可证

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！

## 更新日志

### 1.0.1 (2026-04-22)

- 🔧 默认改为交互模式，解决页面隐藏内容无法展开的问题
- ✨ 新增 `Ctrl+点击` 快速选中元素
- 🎯 选中元素后在元素附近显示浮动输入面板，替代原来的两个独立弹框
- 🗑️ 移除底部通知弹框和顶部输入框

### 1.0.0 (2026-02-09)

- ✨ 初始版本发布
- ✅ Phase 1 MVP 功能实现
- 🎯 可视化元素选择
- 🤖 AI 对话集成

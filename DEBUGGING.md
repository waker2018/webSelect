# 🚀 Antigravity 扩展调试指南

## 问题说明

在 Antigravity 中，`F5` 快捷键与 Antigravity 的内置调试模式冲突，因此需要使用其他方式启动扩展开发。

## ✅ 正确的启动方式

### 方式 1：使用调试面板（推荐）

1. **打开调试面板**
   - 点击左侧活动栏的"运行和调试"图标
   - 或按 `Ctrl+Shift+D`

2. **选择"运行扩展"**
   - 在顶部下拉菜单中选择"运行扩展"

3. **点击绿色播放按钮**
   - 或按 `F6`（我已修改配置避免冲突）

4. **扩展开发主机启动**
   - 会打开一个新的 Antigravity 窗口，标题为 `[Extension Development Host]`
   - 在这个窗口中测试扩展

### 方式 2：使用命令面板

1. 按 `Ctrl+Shift+P` 打开命令面板
2. 输入 `Debug: Start Debugging`
3. 选择"运行扩展"
4. 扩展开发主机启动

### 方式 3：直接安装测试（无需调试）

如果不需要调试，可以直接安装扩展：

```bash
# 1. 打包扩展
npm run package

# 2. 在 Antigravity 中安装
# 按 F1 → 输入 "Extensions: Install from VSIX..."
# 选择生成的 .vsix 文件
```

## 🔧 已修复的配置

我已经更新了以下配置文件：

### `.vscode/launch.json`
- ✅ 修正为 `extensionHost` 类型
- ✅ 配置自动编译（`preLaunchTask`）
- ✅ 添加"运行扩展"配置
- ✅ 添加"扩展测试"配置

### `.vscode/tasks.json`（新建）
- ✅ 配置 TypeScript 编译任务
- ✅ 配置监听模式（`npm run watch`）

## 🎯 使用流程

### 开发模式（可调试）

```
1. 打开 d:\doc\claude\webSelect
2. 按 Ctrl+Shift+D 打开调试面板
3. 选择"运行扩展"
4. 点击绿色播放按钮
5. 在新窗口中打开任意 HTML 文件
6. 按 Ctrl+Shift+E 测试扩展
```

### 生产模式（直接使用）

```
1. cd d:\doc\claude\webSelect
2. npm run package
3. 在 Antigravity 中安装 .vsix
4. 打开 HTML 文件
5. 按 Ctrl+Shift+E 使用
```

## 🐛 调试技巧

### 查看扩展日志

1. **开发主机窗口**：按 `Ctrl+Shift+U` 打开输出面板
2. **选择"Element Selector"通道**：查看详细日志
3. **查看 Webview 控制台**：
   - 在 Webview 上右键
   - 选择"检查元素"
   - 打开 DevTools

### 断点调试

1. 在 `src/extension.ts` 中设置断点
2. 按 `Ctrl+Shift+D` 启动调试
3. 触发相应功能
4. 查看变量、调用栈

### 热重载

修改代码后：
- **不需要重启**：TypeScript 会自动编译（如果运行了 `npm run watch`）
- **需要重新加载扩展**：在开发主机窗口按 `Ctrl+R`

## ❓ 常见问题

### Q: 启动时提示"找不到任务"？

**A:** 运行一次 `npm run compile` 确保 `out` 目录存在。

### Q: 修改代码不生效？

**A:** 
1. 确保 TypeScript 已编译（查看 `out/extension.js` 修改时间）
2. 在开发主机窗口按 `Ctrl+R` 重新加载扩展

### Q: 扩展开发主机打不开？

**A:** 
1. 检查 `out/extension.js` 文件是否存在
2. 查看"输出"面板的错误信息
3. 尝试手动运行 `npm run compile`

### Q: 如何完全卸载扩展？

**A:** 
1. 按 `Ctrl+Shift+X` 打开扩展面板
2. 找到"HTML Element Selector & Modifier"
3. 点击齿轮图标 → 卸载

## 🎬 快速开始示例

完整的测试流程：

```bash
# 1. 确保依赖已安装
cd d:\doc\claude\webSelect
npm install

# 2. 编译 TypeScript
npm run compile

# 3. 在 Antigravity 中打开项目文件夹
# (略)

# 4. 启动调试
# Ctrl+Shift+D → 选择"运行扩展" → 点击播放按钮

# 5. 在开发主机窗口中：
# - 打开 d:\doc\claude\webSelect\web\map_plotting.html
# - 按 Ctrl+Shift+E
# - 鼠标悬停和点击元素
# - 点击"打开 AI 对话"

# 6. 查看效果！
```

## 📚 相关文档

- [VS Code Extension API](https://code.visualstudio.com/api)
- [Extension Development](https://code.visualstudio.com/api/get-started/your-first-extension)
- [Debugging Extensions](https://code.visualstudio.com/api/working-with-extensions/testing-extension)

---

**更新时间**：2026-01-20  
**适用版本**：Antigravity 1.14.2

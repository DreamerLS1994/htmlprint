# 网页打印助手

> 框选页面区域，只打印你想要的内容。广告、侧边栏、评论区全部消失，同时保留网页原始排版。

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-informational)](manifest.json)
[![Chrome / Edge](https://img.shields.io/badge/Browser-Chrome%20%7C%20Edge-success)](#安装)

<!--
截图位置：素材就绪后在此插入 docs/images/ 下的图片，例如：
- 选择模式工具栏：docs/images/screenshot-toolbar.png
- 多区域选择：docs/images/screenshot-multi-select.png
规格与拍摄建议见 docs/images/README.md。
-->

## 解决什么问题

直接按 `Ctrl+P` 打印网页，往往会把广告、导航、推荐位一起打印出来，正文还可能被 `overflow: hidden` 截断。本扩展让你在页面上**点击选择**要打印的区域，只输出选中的内容，并且按选择顺序分页。

## 功能

| 功能 | 说明 |
|------|------|
| 点击框选 | 悬停高亮可打印内容块，点击选中/取消 |
| 粒度调整 | `Alt` + 点击向上一层扩大范围，`Shift` + 点击精确选择最内层元素 |
| 已选列表 | 点击已选计数展开列表，拖拽调整打印顺序、单项删除 |
| 撤销 | `Ctrl+Z` 撤销选择、删除、清除与排序操作 |
| 多区域分页 | 选择多个区域，按选择顺序每页打印一个区域 |
| 保留原始样式 | 克隆选中元素并重建祖先包装器，字体、颜色、表格边框、代码高亮保持原样 |
| 自动展开 | 打印前尝试展开「展开更多 / 阅读全文」类内容，移除 `max-height` 限制 |
| 懒加载图片 | 还原 `data-src`、`srcset` 与 `<picture>` 的真实地址 |
| 内容完整性 | Canvas 画布转为图片，输入框/复选框/下拉框/文本域的当前值一并带入打印 |
| 布局修复 | 打印时重置 `overflow`、`position: fixed/sticky`、`transform` 等截断性属性 |
| 图片约束 | 图片宽度不超出页面、高度不超过 22cm，保持比例 |
| 快捷键 | `Enter` 打印，`Ctrl+Z` 撤销，`Esc` 退出选择模式 |

## 安装

### Chrome

1. 下载本仓库并解压（或 `git clone`）。
2. 打开 `chrome://extensions/`，开启右上角「开发者模式」。
3. 点击「加载已解压的扩展程序」，选择**仓库根目录**（包含 `manifest.json` 的目录）。

### Edge

打开 `edge://extensions/`，其余步骤同上。其他 Chromium 内核浏览器（Brave、360 等）操作类似。

## 使用

1. 点击工具栏中的扩展图标，页面进入选择模式（鼠标变为十字光标）。
2. 移动鼠标，高亮框显示将要打印的内容块。
3. 点击选中，左上角出现选择序号；再次点击可取消。
4. 需要调整范围时：`Alt` + 点击向外扩大一层，`Shift` + 点击选中鼠标下的最内层元素。
5. 点击工具栏「已选 N 个」打开区域列表，可拖拽调整顺序或单项删除；`Ctrl+Z` 撤销上一步选择操作。
6. 点击工具栏「打印」（或按 `Enter`）进入打印预览，保存为 PDF 或直接打印。
7. 按 `Esc` 或点击「退出」结束选择模式。

更详细的使用说明见 [docs/USAGE.md](docs/USAGE.md)。

## 权限与隐私

扩展当前声明的权限：

- `activeTab`、`scripting`：点击图标后与当前标签页交互。
- `content_scripts` 匹配 `<all_urls>`：选择逻辑需要注入到当前页面。
- `host_permissions`（`https://api.github.com/*`、`https://cdn.jsdelivr.net/*`）：仅用于「检查更新」读取版本信息。
- `storage`：在本地缓存更新检查结果，避免频繁请求。

数据说明：

- 扩展**不收集、不上传**任何页面内容、浏览记录或个人数据。
- 点击「检查更新」优先请求 GitHub Releases API（`api.github.com`）；若 API 请求失败（例如未认证接口限流），会回退到 jsDelivr 上的 `version.json` 获取版本。
- 检查结果会在本地缓存 1 小时，期间重复点击不会再次请求；缓存仅包含版本号、下载地址与检查时间。
- 若仓库尚未发布 Release，会提示「当前还没有发布版本」，可选择打开 Releases 页面。
- 请求不携带任何页面内容或个人信息。

## 已知限制

- 克隆时只重建 `<body>` 之下的祖先链，且不复制祖先的内联样式。因此依赖 `body` 上的 class（如暗色主题）或祖先内联布局的站点，打印效果可能与页面不同。
- 未穿透 `iframe` 与 Shadow DOM，正文位于其中的页面暂不支持选择。
- 打印前会全局点击「展开更多」类按钮并移除 `max-height`，这可能改变页面状态，且退出后不会完全还原，建议在打印完成后刷新页面。
- 严格 CSP 的站点可能拦截注入的 `<style>`，导致选择框或打印样式缺失。

- 部分站点通过 JavaScript 动态注入样式，克隆后可能丢失。

## 项目结构

```
htmlprint/
├── manifest.json            # 扩展配置（Manifest V3）
├── version.json             # 更新检查备用源（jsDelivr 读取）
├── background.js            # 后台 Service Worker（图标点击、更新检查）
├── content.js               # 核心逻辑（元素选择、打印、样式注入）
├── icons/                   # 16/32/48/128 正方形图标
├── libs/
│   └── Readability.js       # 第三方正文提取库（Apache-2.0，尚未启用）
├── docs/
│   ├── USAGE.md             # 使用说明
│   └── images/              # README 截图素材
├── scripts/
│   └── generate_icons.py    # 从 logo.png 生成多尺寸图标
├── .github/
│   └── workflows/
│       └── release.yml      # 推送 tag 时自动打包并发布 Release
├── pack.bat                 # Windows 本地打包脚本
├── LICENSE
└── THIRD-PARTY-NOTICES.md
```

## 开发与打包

本项目无构建步骤，修改源码后在 `chrome://extensions/` 点击「重新加载」即可生效。

Windows 下运行 `pack.bat` 会读取 `manifest.json` 中的版本号，生成 `htmlprint-v{版本}.zip`：

```bat
pack.bat
```

图标由 `logo.png` 生成（需要 Python 与 Pillow）：

```bash
python scripts/generate_icons.py
```

发布新版本时：

1. 修改 `manifest.json` 的 `version`，并同步更新 `version.json` 的 `version`、`url`、`download`，提交并推送。
2. 创建并推送同版本号的 tag（如 `v1.0.1`）。GitHub Actions 会校验版本一致性，自动打包 `htmlprint-v{版本}.zip` 并创建或更新 Release。
3. Tag 与 `manifest.json` 的 `version` 必须一致（`{版本}` 或 `v{版本}` 均可），否则工作流会直接失败。
4. 扩展的「检查更新」优先调用 GitHub Releases API，失败时回退到 jsDelivr 上的 `version.json`；本地版本高于线上最新 Release 时会提示「正在使用开发版本」。
5. 需要在本地验证时，仍可运行 `pack.bat` 生成同内容的 zip。

## 路线图

- [x] 更新检查迁移到 GitHub Releases，移除对个人服务器的依赖
- [ ] 支持 iframe 与 Shadow DOM 内容选择
- [ ] 打印后还原被「展开更多」修改的页面状态
- [ ] 可选接入 `libs/Readability.js` 实现一键正文打印
- [ ] 界面国际化（zh-CN / en）
- [x] GitHub Actions 自动打包与 Release

## 贡献

欢迎提交 Issue 和 Pull Request。请描述复现步骤、浏览器版本和目标网址（如涉及隐私请用示例页面替代）。

## 第三方组件

`libs/Readability.js` 来自 Mozilla Readability，遵循 Apache License 2.0，详见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md)。

## 许可证

[MIT](LICENSE) © 2020-2026 DreamerLS1994
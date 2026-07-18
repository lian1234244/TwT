# Mineradio - Mikalinsa Edition

> Windows Electron 沉浸式音乐播放器的社区二次创作版。

![Mineradio](./docs/assets/readme/cinema-beat-smoke.png)

[下载最新版本](https://github.com/Mikalinsa/Mineradio-derivative-work/releases/latest) · [更新记录](./CHANGELOG.md) · [构建说明](./BUILDING.md) · [隐私说明](./PRIVACY.md) · [安全政策](./SECURITY.md)

## 项目身份

本仓库是 [XxHuberrr/Mineradio](https://github.com/XxHuberrr/Mineradio) 的二次创作，不是上游官方仓库或官方客户端。

- 上游基线：Mineradio `v1.1.1`
- 二次创作维护者：[Mikalinsa](https://github.com/Mikalinsa)
- 当前版本：`v1.1.5 Mikalinsa Edition`
- 许可证：GNU GPL v3.0

上游作者与贡献者的版权和署名完整保留；Mikalinsa Edition 的新增与修改内容单独标识。完整归属见 [NOTICE.md](./NOTICE.md)，第三方组件见 [THIRD_PARTY_NOTICES.md](./THIRD_PARTY_NOTICES.md)。

## 主要功能

- 网易云音乐、QQ 音乐与酷狗音乐的用户授权登录、搜索、歌单和播放辅助
- 多平台真实喜欢状态与歌单操作同步
- 歌词舞台、桌面歌词、词场、磁性词场、杂志排版、音轨星图等视觉预设
- 自定义封面粒子、图片裁剪、背景媒体和 Wallpaper Engine 壁纸工作流
- 3D 歌单架、可拖动播放队列、Home DIY 与磁带机控制
- Graphic EQ、平台音质选择、自动降级和节奏分析
- 面向不同硬件的自适应性能与交互调度

## 下载与校验

安装包只在本仓库的 [GitHub Releases](https://github.com/Mikalinsa/Mineradio-derivative-work/releases) 发布。每个正式版本提供：

- Windows x64 安装器
- SHA-256 校验文件
- 更新说明与发布清单
- 与该二进制对应的 Git 标签及 GitHub 源码归档

这是尚未进行商业代码签名的社区发行版。若下载来源、文件名或 SHA-256 与 Release 不一致，请不要运行。

## 开发与构建

```powershell
npm ci
npm start
npm run build:win:dir
npm run package:installer
```

完整环境、OBS 与 FFmpeg 输入说明见 [BUILDING.md](./BUILDING.md)。

## 隐私与第三方平台边界

账号 Cookie、Token、搜索历史、自定义图片、歌词、播放记录和缓存只应保存在用户本机，不属于开源仓库内容。提交 Issue 前请清除日志中的账号和本地路径。

Mineradio Mikalinsa Edition 不是网易云音乐、QQ 音乐、酷狗音乐、腾讯音乐娱乐集团、Wallpaper Engine 或 OBS Studio 的官方产品，也不受其认可或赞助。平台功能依赖用户自己的合法账号、网络环境及平台接口状态；用户应遵守各平台协议和适用法律。

本项目不提供或鼓励绕过付费、会员、地域限制、DRM、反爬机制或版权保护，也不分发音乐文件。平台接口变化可能导致部分功能失效。

## 贡献与安全

- 贡献规范：[CONTRIBUTING.md](./CONTRIBUTING.md)
- 行为准则：[CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- 漏洞报告：[SECURITY.md](./SECURITY.md)

## 许可证与免责声明

Copyright (C) 2026 XxHuberrr and Mineradio contributors.
Modifications Copyright (C) 2026 Mikalinsa.

本程序按 GNU GPL v3.0 提供，不附带任何明示或默示担保，包括适销性或特定用途适用性的担保。详见 [LICENSE](./LICENSE)。第三方组件仍按各自许可证分发。

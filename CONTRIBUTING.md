# Contributing to Mineradio Mikalinsa Edition

感谢你参与本项目。提交代码即表示你确认自己有权按 GPL-3.0 提供该贡献，并同意其随项目按 GPL-3.0 分发。

## 开发流程

1. 从 `main` 创建分支，保持改动范围清晰。
2. 不得提交 Cookie、Token、账号截图、本地媒体、Wallpaper 缓存或用户数据。
3. 修改第三方组件时同步更新 `THIRD_PARTY_NOTICES.md`。
4. 修改用户可见行为时在 `CHANGELOG.md` 的未发布区说明。
5. 提交前运行：

```powershell
npm ci
node --check server.js
npm test --if-present
npm run build:win:dir
```

## 平台接入边界

第三方音乐平台接入只能使用用户本人授权的会话，不得提交共享账号、绕过会员、解密受保护媒体、移除版权信息或重新分发音乐内容的实现。

## 问题与漏洞

一般问题使用 GitHub Issues。安全漏洞按 `SECURITY.md` 私下报告，不要把 Cookie、Token、可利用细节或个人信息贴进公开 Issue。

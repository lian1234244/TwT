# Security Policy

## Supported versions

仅最新正式版本接收安全修复。历史 Release 用于审计和回退，不代表仍受支持。

## Reporting a vulnerability

请优先使用 GitHub 的 Private vulnerability reporting；若该入口不可用，请通过维护者 GitHub 主页提供的私密联系方式报告。请勿在公开 Issue 中披露可利用细节。

报告建议包含版本、Windows 版本、影响、最小复现步骤和已经脱敏的日志。不要发送 Cookie、Token、登录二维码、真实账号、私人媒体或不必要的个人信息。

维护者会确认收到报告、评估影响并在可行时协调修复与披露时间。我们不会承诺固定响应期限，但会优先处理账号泄露、远程代码执行、更新链劫持和本地权限提升问题。

## Installer verification

只从本仓库 Releases 下载安装器，并用同一 Release 的 SHA-256 文件校验。当前社区安装器未进行商业代码签名；SmartScreen 声誉提示不等同于恶意软件判定，但文件哈希不匹配时必须停止运行。

## Account sessions

平台 Cookie 应仅保存在用户本机。怀疑泄露时应立即在对应音乐平台退出所有设备/撤销会话并更改密码。公开仓库不会接受包含有效会话的测试数据。

## Dependency and release hygiene

正式发布前应运行依赖审计、密钥扫描、语法测试、打包测试和安装器哈希生成。新增第三方二进制必须记录版本、来源、许可证和对应源码获取方式。

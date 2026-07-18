'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const output = path.join(root, 'release-notes');
fs.mkdirSync(output, { recursive: true });

for (const version of ['1.1.2', '1.1.3', '1.1.4', '1.1.5']) {
  const base = `Mineradio-Mikalinsa-${version}`;
  const manifestPath = path.join(dist, `${base}-release-manifest.json`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const lines = [
    `# Mineradio v${version} - Mikalinsa Edition`,
    '',
    '> 本版本是基于 XxHuberrr/Mineradio v1.1.1 的社区二次创作发行版，不是上游官方版本。',
    '',
    '## 更新内容',
    '',
    ...manifest.releaseNotes.map((note) => `- ${note}`),
    '',
    '## 下载与校验',
    '',
    `- 安装器：\`${manifest.installer}\``,
    `- SHA-256：\`${manifest.sha256}\``,
    '- Windows x64，社区发行版，当前未进行商业代码签名。',
    '- 仅从本 Release 下载，并核对同页 SHA-256 文件。',
    '',
    '## 源代码与许可证',
    '',
    `- 对应 Mineradio 应用源码：\`${base}-Corresponding-Source.zip\`（从该安装器内直接提取的应用源码，并附构建支持文件）。`,
    `- 源码校验：\`${base}-Corresponding-Source.zip.sha256.txt\`。`,
    `- Git 标签 \`v${version}\` 用于标记版本；Release 资产中的对应源码包是历史二进制的审计基准。`,
    '- 主项目许可证：GNU GPL v3.0。',
    '- 上游与修改归属：见 `NOTICE.md`。',
    '- OBS、FFmpeg、KuGouMusicApi 等第三方组件：见 `THIRD_PARTY_NOTICES.md` 与 `SOURCE_OFFER.md`。',
    '',
    '## 使用边界',
    '',
    '本项目不隶属于任何音乐平台。平台功能仅供用户在本人授权账号与合法权益范围内使用；不提供绕过会员、DRM、地域限制或版权保护的能力，也不分发音乐文件。接口可能因平台调整而失效。',
    '',
    '安装器默认不包含用户 Cookie、Token、私人媒体或用户配置。提交反馈前请脱敏日志与截图。',
    ''
  ];
  fs.writeFileSync(path.join(output, `v${version}.md`), lines.join('\n'));
}

fs.writeFileSync(path.join(output, 'v1.1.1-upstream-baseline.md'), [
  '# Mineradio v1.1.1 - upstream baseline',
  '',
  '这是 Mikalinsa Edition 使用的上游基线说明，不是 Mikalinsa 的原创发行版。',
  '',
  '- 上游作者/维护者：XxHuberrr 及原项目贡献者',
  '- 上游仓库：https://github.com/XxHuberrr/Mineradio',
  '- 上游 Release：https://github.com/XxHuberrr/Mineradio/releases/tag/v1.1.1',
  '- 许可证：GNU GPL v3.0',
  '',
  '为避免混淆来源，本二次创作仓库不重新署名发布上游 v1.1.1 安装器；请从上游 Release 获取原始版本。',
  ''
].join('\n'));

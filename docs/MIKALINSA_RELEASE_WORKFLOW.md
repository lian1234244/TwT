# Mikalinsa Edition 发布工作流

## 版本与身份

- 产品兼容名称保持 `Mineradio`，避免破坏安装升级、用户数据和 `appId` 链路。
- 二次创作发行标识固定为 `Mikalinsa Edition`，维护者/GitHub 用户名为 `Mikalinsa`。
- 版本遵循 SemVer：修复递增补丁位，兼容功能递增次版本，不兼容变更递增主版本。
- 每次正式生成安装器必须使用新版本号，不得覆盖或伪装成旧发行版。

## 发布步骤

1. 同步修改 `package.json` 与 `package-lock.json` 中的版本号。
2. 在 `CHANGELOG.md` 顶部增加完全匹配的 `## vX.Y.Z`，至少写一条用户可理解的更新。
3. 执行 `npm run package:installer`。
4. 工作流自动执行语法检查、全部测试、个人数据扫描、NSIS 打包与 SHA256 计算。
5. 对外发布安装器、blockmap、更新说明、SHA256 和 release manifest。

## 产物命名

```text
Mineradio-Mikalinsa-X.Y.Z-Setup.exe
Mineradio-Mikalinsa-X.Y.Z-Setup.exe.blockmap
Mineradio-Mikalinsa-X.Y.Z-更新说明.txt
Mineradio-Mikalinsa-X.Y.Z-SHA256SUMS.txt
Mineradio-Mikalinsa-X.Y.Z-release-manifest.json
```

安装器界面必须同时显示版本号与 `Mikalinsa Edition`，但主程序仍使用 `Mineradio.exe`。

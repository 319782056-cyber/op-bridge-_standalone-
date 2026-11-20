# OP 桥图绘制看板

一个可直接在浏览器中使用的桥图绘制工具，支持图表编辑、参数配置、数据表格、Excel 导入导出，以及 PNG/SVG 导出。

## 数据存储与隐私

- 图表文档自动保存在当前浏览器的本地存储中。
- 不需要注册账号，文档不会自动上传到服务器。
- 可通过内置的 JSON 文件备份与恢复功能迁移文档。
- 清理浏览器数据或更换设备前，请先导出备份文件。
- 备份文件未加密，请妥善保管。

## 本地开发

需要 Node.js 20 或更高版本。

```bash
npm install
npm run dev
```

## 生产构建

```bash
npm run build
npm run preview
```

构建产物位于 `dist/` 目录。

## 自动部署

推送到 `main` 分支后，GitHub Actions 会自动安装依赖、构建项目并发布到 GitHub Pages。首次使用时，请在仓库 Settings → Pages 中将部署来源设置为 GitHub Actions。

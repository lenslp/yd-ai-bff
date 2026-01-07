# Biome

本工程使用 [Biome](https://biomejs.dev/) 做格式化与 lint（配置见 `biome.json`），尽量对齐 Prettier 的默认风格（2 空格缩进、80 列、双引号、分号、trailing commas）。

## 安装

```bash
yarn
```

## 常用命令

```bash
# 只 lint
yarn lint

# 只格式化（写回文件）
yarn format

# lint + format 检查（不写回）
yarn check
```


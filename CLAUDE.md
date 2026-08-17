# Spine 工作区

本工作区（`D:\spine`）专用于 **Spine** —— 二维骨骼动画运行时与工具链。

## 语言

默认工作语言：**中文 (Chinese)**。文档、注释、与 Claude 的对话均优先使用中文；技术名词、文件名、API、标识符保留英文原文。

## Target Engine — Godot (强约束)

所有 Spine 资产、动画、皮肤、运行时方案 **必须适配 Godot 4** 引擎。具体约束：

| 项目 | 约束 |
|------|------|
| 运行时 | `spine-godot` 官方运行时（4.x，对应 Spine 编辑器 4.2+） |
| 导出格式 | **JSON 格式**（`.json` + `.atlas`），不要用二进制 `.skel`，便于 Godot 导入与版本 diff |
| 节点 | Godot 中通过 `SpineSprite` 节点加载，GDScript 或 C# 调用 API |
| 版本兼容 | Spine 编辑器 ≥ 4.2；spine-godot ≥ 4.2；Godot ≥ 4.3 |
| 资源组织 | Godot 项目的 `res://spine/` 目录下；纹理走 `.import` 管线 |
| 动画状态 | 使用 `AnimationState` 的 `TrackEntry` 做混合/过渡 |
| 皮肤切换 | `Skeleton.set_skin(name)` / `add_skin()` |
| 异化扩展 | 通过 **基础骨骼 + 换皮 + 子模板派生** 实现（详见 `docs/eva_spine_design.md`） |

任何方案讨论、模板生成、代码示例，默认面向 Godot 适配；如无特别说明，禁止产出仅适用于 libgdx/Unity/Phaser 的方案。

## 目录结构

- `reference/` — Spine 参考资料
  - `spine-runtimes-4.3/` — 官方 Spine 运行时（4.3）
- `docs/` — 设计文档
  - `eva_spine_design.md` — Eva 原型角色骨骼/Slot/Skin 设计规范
- `assets/` — Eva 原型资源（后续按设计落地）
- `.claude/` — Claude Code 项目配置与记忆
- `.git/` — 版本控制
- `tmp/` — **临时目录**：所有 deep research（深度研究）、全网搜索（web search / Tavily / 各类爬取）产生的临时文件、笔记、下载产物均放在此目录下。该目录**不纳入版本控制**，可随时清理。

## Workflow — 渐进迭代

本项目采用 **MVP → 增强 → 完整** 三层渐进策略：

```
L0 MVP      最小可运行：能站立 + 待机 + 一个攻击
L1 增强     加入装备换装 + 基础表情切换
L2 完整     加入披风动态链 + 完整表情 + 异化扩展接口
L3 扩展     派生变体角色（通过 skin / bone 扩展）
```

每个层级标注 **[必选] / [推荐] / [可选]**，落地时优先保证 [必选] 可运行，再逐步补齐。

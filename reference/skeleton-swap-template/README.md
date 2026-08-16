# Spine 4.3 角色换装模板（精简版）

最小化的 Spine 4.3 换装骨架 — **18 根骨骼，零 skin-bones，纯 attachment 切换**。
适合卡牌 / Q版 / 休闲 / 表情包 / 静态角色。

> 需要长发/披风/裙摆摆动？去看 `examples/mix-and-match/` 的完整方案。

## 文件清单

```
skeleton-swap-template/
├── build-template.cjs    生成器（Node.js，可二次扩展）
├── skeleton.json         生成产物，可直接导入 Spine 4.3
└── README.md             本文档
```

## 重新生成

```bash
node build-template.cjs
```

## 导入 Spine 4.3 编辑器

1. 启动 Spine 4.3.x 编辑器
2. 菜单 `Spine` → `Import Data...`
3. 选择 `skeleton.json`
4. `File → Save As` 存为 `skeleton.spine`

> 导入后所有 attachment 是 16x16 白色占位 region，用右侧 Images 面板导入 PNG 后拖入对应 attachment。

## 骨架结构（18 根，零 skin-bones）

```
root
└── hip
    ├── body
    │   ├── head
    │   ├── upperarm1 → forearm1 → hand1 → weapon-l   (双持左)
    │   └── upperarm2 → forearm2 → hand2 → weapon-r   (双持右)
    ├── thigh1 → shin1 → foot1
    └── thigh2 → shin2 → foot2
```

**这就是 hero-ess 的 18 根骨架 + 双持 weapon 子骨，无任何附加。**

## Slot 顺序（20 个，从底到顶渲染）

```
1. thigh1    2. shin1     3. foot1
4. thigh2    5. shin2     6. foot2
7. body
8. upperarm1  9. upperarm2  10. forearm1  11. forearm2
12. hand1     13. hand2
14. head      15. eyes      16. mouth
17. hair-back  18. hair-front
19. weapon-l  20. weapon-r   ← 永远在最上层
```

## Skin 清单（10 个，纯 attachment 切换）

| Skin 名 | 切换内容 |
|---------|---------|
| `skin-base` | 基础人体 + 脸（必装） |
| `hair/short-brown` | 短发棕 |
| `hair/short-blue` | 短发蓝 |
| `hair/long-brown` | 长发棕（仍是静态图，无摆动） |
| `clothes/tshirt-red` | 红色 T 恤（覆盖 body attachment） |
| `clothes/dress-blue` | 蓝色连衣裙（覆盖 body 为更长 attachment） |
| `weapon-l/sword` | 左剑 |
| `weapon-l/dagger` | 左匕首 |
| `weapon-r/shield` | 右盾 |
| `weapon-r/bow` | 右弓 |

**所有 skin 都是纯 attachment 切换，没有任何 skin-bones。**
换装速度极快，CPU/GPU 占用可忽略。

## 运行时换装（Godot 4 示例）

```gdscript
func equip_outfit(config: Dictionary):
    var data = get_skeleton().get_data()
    var combined = new_skin("outfit")

    # 基础人体（必须）
    combined.add_skin(data.find_skin("skin-base"))

    # 头发
    combined.add_skin(data.find_skin(config.hair))

    # 服装
    combined.add_skin(data.find_skin(config.clothes))

    # 双持武器（独立 attach）
    combined.add_skin(data.find_skin(config.weapon_l))
    combined.add_skin(data.find_skin(config.weapon_r))

    get_skeleton().set_skin(combined)
    get_skeleton().set_setup_pose_slots()

# 调用
equip_outfit({
    "hair": "hair/long-brown",
    "clothes": "clothes/dress-blue",
    "weapon_l": "weapon-l/sword",
    "weapon_r": "weapon-r/shield",
})
```

## 扩展你的换装

### 新增一件 T 恤

```javascript
// 在 build-template.cjs 的 skins 数组里加：
skinWithAttachments('clothes/tshirt-blue', {
  'body': { 'tshirt-blue': regionAttachment('tshirt-blue', 0, 0, 0, 28, 40) },
}),
```

### 新增武器

```javascript
skinWithAttachments('weapon-r/staff', {
  'weapon-r': { staff: regionAttachment('staff', 0, -20, 0, 4, 40) },
}),
```

### 新增一个发型（无需物理，纯静态图）

```javascript
skinWithAttachments('hair/ponytail-red', {
  'hair-back':  { 'ponytail-red-back':  regionAttachment('ponytail-red-back',  0, -10, 0, 24, 28) },
  'hair-front': { 'ponytail-red-front': regionAttachment('ponytail-red-front', 0, 10, 0, 24, 12) },
}),
```

### 什么时候需要升级到带 skin-bones 的版本？

| 需求 | 是否需要 skin-bones |
|------|---------------------|
| 头发只是形状不同（短发/长发/马尾/双马尾） | ❌ 不需要 |
| 头发需要随角色跑动摆动 | ✅ 需要 hair-base→hair-N 链 |
| 披风/斗篷需要飘动 | ✅ 需要 cape-base→cape-N 链 |
| 裙摆需要物理 | ✅ 需要 dress-base→dress-N 链 |
| 围巾/背包摆动 | ✅ 需要 |

**如果将来需要物理**，拷贝本模板的 18 骨基础，按 `examples/mix-and-match/` 的
skin-bones 模式追加物理链即可。Slot 命名已经预留兼容。

## 对比表

| | mix-and-match-pro | 上版本 (24-33 骨) | **本版本 (18 骨)** |
|---|---|---|---|
| 共享骨 | 143 | 18 | **18** |
| skin-bones | 125 (多套) | 6-15 | **0** |
| 物理链 | 5+ | 3 | **0** |
| Slot 数 | 80 | 28 | **20** |
| 双持武器 | ✗ | ✓ | **✓** |
| 换装性能 | 中（attachment 重计算） | 中 | **极快** |
| 适用 | 3D 写实 ARPG | 中等动作 | **卡牌/Q版/休闲/表情包** |
| 学习曲线 | 陡 | 中 | **平** |

## 验证清单

导入 Spine 编辑器后：
1. 右下 Skins 面板勾选 `skin-base` → 看到基础人体
2. 加上 `hair/short-brown` → 头发出现
3. 加上 `clothes/tshirt-red` → 上衣变化
4. 加上 `weapon-l/sword` + `weapon-r/shield` → 双持武器出现
5. 播放 `idle` 动画 → 全身轻微上下浮动

整过程**无任何 skin-bones 激活**，纯 attachment 切换，最快最简单。

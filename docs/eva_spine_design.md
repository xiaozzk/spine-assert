# Eva Spine Design — RPG 角色骨骼原型设计规范

> 版本：v1.0  
> 适配引擎：**Godot 4.3+ / spine-godot 4.2+**  
> 角色定位：**RPG 主角原型** —— 通过换皮与骨骼派生做异化变体  
> 设计策略：**MVP → 增强 → 完整 → 扩展** 渐进迭代

---

## 0. 文档目标

1. 给出 Eva 原型的**最小可运行骨骼方案**（L0），让团队能在最短时间内看到角色在 Godot 中站立+动起来；
2. 规划**渐进迭代路线**（L1 → L2 → L3），明确每个层级的「必选 / 推荐 / 可选」范围；
3. 设计**异化扩展接口**，让 Eva 通过 Skin/Bone 派生即可生成变体角色（法师版/弓手版/暗黑版等）；
4. 提供**Godot 4 集成示例**与**资源组织规范**，可直接落到 `res://spine/` 目录。

---

## 1. 三大系统分工（设计原则）

| 维度 | 工具 | 例子 | 谁负责 |
|------|------|------|--------|
| **动** | 骨骼关键帧 / IK / 路径约束 | 走、跑、攻击、待机呼吸 | Spine 动画师 |
| **换** | Slot + Attachment | 武器、装备、发型 | 美术 / 程序 |
| **表** | Skin 切换 | 表情、状态光效、阵营色 | 美术 / 剧情 |

> 🎯 **黄金法则**：能换的用 Skin，能拆的用 Slot，必须动的才用骨骼。

---

## 2. 渐进层级路线（每个层级）

```
L0 MVP ───────── 最小可运行：站立 + 待机呼吸 + 一次性攻击
                [必选]   用于打通 Godot 流水线 + 验证美术风格
L1 增强 ───────── 加入基础换装 + 2 个表情切换
                [推荐]   满足 RPG 基本对话/战斗循环
L2 完整 ───────── 加入披风动态链 + 完整 6 表情 + 异化扩展接口
                [推荐]   商业级主角标配
L3 扩展 ───────── 派生第一个变体角色（通过 Skin/Bone）
                [可选]   验证异化扩展链路是否成立
```

---

## 3. 骨骼方案（按层级）

### 3.1 L0 MVP —— 13 根 [必选]

```
root
└─ hip
    ├─ torso
    │   ├─ head
    │   ├─ upperArm_L → hand_L (合并 forearm)
    │   └─ upperArm_R → hand_R
    ├─ thigh_L → shin_L
    └─ thigh_R → shin_R
```

**适用动画**：待机呼吸、原地踏步、一次性挥砍  
**省略代价**：披风/头发不能独立摆动、表情不能切换（贴图整体替换）

> ✅ **必须落地**：这是 Godot 流水线打通的前提。

### 3.2 L1 增强 —— 17 根 [推荐]

```
root
└─ hip
    ├─ torso
    │   ├─ chest (呼吸锚点)
    │   │   ├─ neck
    │   │   │   └─ head
    │   │   ├─ upperArm_L → forearm_L → hand_L
    │   │   └─ upperArm_R → forearm_R → hand_R
    ├─ thigh_L → shin_L → foot_L
    └─ thigh_R → shin_R → foot_R
```

**新增能力**：呼吸缩放、行走循环、武器挂载、表情 Skin 切换  
**新增动画**：walk、run、cast

### 3.3 L2 完整 —— 22 根 [推荐]

在 L1 基础上加入**披风链**与**头部表情骨骼**：

```
root
└─ hip
    ├─ torso
    │   ├─ chest
    │   │   ├─ neck
    │   │   │   └─ head
    │   │   │       └─ jaw (说话张合)
    │   │   ├─ shoulder_L → upperArm_L → forearm_L → hand_L
    │   │   └─ shoulder_R → upperArm_R → forearm_R → hand_R
    │   ├─ cloak_root
    │   │   ├─ cape_1
    │   │   └─ cape_2
    ├─ thigh_L → shin_L → foot_L
    └─ thigh_R → shin_R → foot_R
```

**新增能力**：披风物理摆动、说话口型、独立转身

### 3.4 L3 扩展 —— 25~30 根 [可选]

在 L2 基础上追加：
- 头发链：`hair_root → hair_back_1 → hair_back_2`
- 武器槽：`weapon_root_L / weapon_root_R`（独立于 hand，避免旋转污染）
- 特效锚点：`FX_root`（绑 hand_R 或 chest）

---

## 4. Slot 方案（按层级）

### 4.1 Slot 命名规范

格式：`{部位}_{方位?}_{用途?}`  
例：`boots_L`, `eyebrow_R`, `cape_main`, `FX_root`

### 4.2 L0 MVP —— 10 个 Slot [必选]

| # | Slot 名 | 绑定骨骼 | 用途 |
|---|---------|---------|------|
| 1 | `body_main` | torso | 主长袍 |
| 2 | `head_base` | head | 脸（暂无表情拆分） |
| 3 | `headwear` | head | 头饰 |
| 4 | `hair_back` | head | 后发 |
| 5 | `hair_front` | head | 刘海 |
| 6 | `cape_main` | torso | 披风（静态贴图） |
| 7 | `glove_L` | upperArm_L | 手套 |
| 8 | `glove_R` | upperArm_R | |
| 9 | `boots_L` | shin_L | 靴子 |
| 10 | `boots_R` | shin_R | |

> L0 阶段**不拆表情 Slot**，因为没有表情切换需求，整体换贴图即可。

### 4.3 L1 增强 —— 18 个 Slot [推荐]

在 L0 基础上：
- 新增 `wristband_L/R`（护腕）
- 新增 `breastpin`（胸针）
- 新增 `belt`（腰带）
- 新增 `weapon_L`（武器挂点）
- **新增表情拆分**：
  - `eyebrow_L / eyebrow_R`
  - `eye_L / eye_R`
  - `mouth`

### 4.4 L2 完整 —— 29 个 Slot [推荐]

完整 Slot 表（与之前方案一致）：

**身体基础**：`body_skin, body_main, body_sub`  
**装备**：`headwear, breastpin, belt, cape_main, cape_lining, cape_decor, glove_L/R, wristband_L/R, boots_L/R`  
**表情**：`head_base, eyebrow_L/R, eye_L/R, mouth`  
**头发**：`hair_back, hair_front_L/R, hair_side_L/R`  
**武器/特效**：`weapon_L/R, FX_root`

---

## 5. Skin 方案（按层级）

### 5.1 Skin 命名规范

- 装备换装：`equip_{部位}_{id}` → `equip_cape_red`, `equip_cape_black`
- 表情切换：`face_{状态}` → `face_normal`, `face_angry`
- 异化变体：`variant_{角色名}` → `variant_eva_mage`, `variant_eva_archer`

### 5.2 L0 MVP —— 1 个 Skin [必选]

只有默认皮肤 `default`，包含所有 L0 Slot 的基础贴图。

### 5.3 L1 增强 —— 7 个 Skin [推荐]

- 基础：`default`
- 表情（2个）：`face_normal`, `face_angry`
- 装备示例（4个）：`equip_cape_red`, `equip_cape_blue`, `equip_weapon_sword`, `equip_weapon_staff`

### 5.4 L2 完整 —— 13+ 个 Skin [推荐]

完整 6 表情 + 装备全量 + 1 个异化变体种子。

### 5.5 Skin 继承策略（关键）

利用 Spine 4.x 的 Skin 继承，减少贴图引用重复：

```
default                  ← 基础皮肤（含全部默认贴图）
├─ face_normal (继承 default，仅覆写 eyebrow/eye/mouth)
├─ face_angry (继承 default)
├─ face_smile (继承 default)
├─ ... (其他表情)
├─ equip_cape_red (继承 default，仅覆写 cape_main/lining/decor)
├─ equip_weapon_sword (继承 default，仅覆写 weapon_L)
└─ variant_eva_mage (继承 default + face_normal + equip_cape_purple)
                    ↑ 支持多层继承
```

**运行时叠加**（Godot GDScript）：

```gdscript
# 把多个 Skin 合并到一个运行时 Skin 里
var combined := Skeleton.new_skin("runtime_combined")
combined.add_skin(skeleton.data.find_skin("default"))
combined.add_skin(skeleton.data.find_skin("face_angry"))
combined.add_skin(skeleton.data.find_skin("equip_cape_black"))
skeleton.set_skin(combined)
```

---

## 6. 异化扩展机制（核心 ⭐）

### 6.1 异化的两种路径

```
异化扩展路径
│
├─ 路径 A：Skin 换装（轻量，推荐优先用）
│   ├─ 同骨骼结构
│   ├─ 通过 Skin 继承叠加，覆盖装备/表情/光效
│   └─ 适合：同职业不同流派（红/蓝/紫法师）
│
└─ 路径 B：骨骼派生（重量，需要重建模板）
    ├─ 复制 Eva 模板 → eva_archer.skel
    ├─ 增删骨骼（如弓手不需要 cloak_root，改为 quiver_root）
    ├─ 增删 Slot/Attachment
    └─ 适合：跨职业变体（弓手/刺客/重甲）
```

### 6.2 Skin 换装实现（路径 A）

**例：Eva 法师变体（保留所有骨骼，仅换 Skin）**

```
所需 Skin：
├─ variant_eva_mage
│   ├─ 继承：default + face_normal
│   ├─ 覆写 cape_main (紫色长袍法师袍)
│   ├─ 覆写 weapon_R (法杖)
│   ├─ 覆写 breastpin (蓝色宝石)
│   └─ 覆写 body_sub (高领内衬)
└─ equip_fx_magic_circle (可选，叠加手部光效)
```

**Godot 调用**：

```gdscript
func _ready():
    spine_sprite.skeleton.set_skin("variant_eva_mage")
    spine_sprite.skeleton.set_slots_to_setup_pose()
```

### 6.3 骨骼派生实现（路径 B）

**例：Eva 弓手变体**

```
操作步骤（Spine 编辑器）：
1. File → Export → 保存 eva.json 作为模板
2. 新建 eva_archer.json
3. 在 Setup Mode 下：
   ├─ 删除 cloak_root / cape_1 / cape_2（3根骨骼）
   ├─ 删除 cape_main / cape_lining / cape_decor（3个 Slot）
   ├─ 新增 quiver_root（箭筒，挂在 torso 下方）
   ├─ 新增 quiver Slot
   └─ 在 hand_L 增加 bow_string Slot
4. 导出 JSON
```

**Godot 加载多个角色模板**：

```gdscript
# resource://spine/eva/eva.json       (原型)
# resource://spine/eva/eva_archer.json (弓手派生)
# resource://spine/eva/eva_mage.json   (法师派生)

func spawn_avatar(variant: String) -> SpineSprite:
    var sprite := SpineSprite.new()
    sprite.skeleton_data_resource = load("res://spine/eva/eva_%s.json" % variant)
    return sprite
```

### 6.4 异化扩展的运行时数据驱动

为了支持**策划配置驱动变体**，不要在代码里写死 Skin 名称。用资源表：

```
res://data/avatar_variants.tres
├─ "eva_default"     → skin=default, template=eva.json
├─ "eva_mage"        → skin=variant_eva_mage, template=eva.json
├─ "eva_archer"      → skin=default, template=eva_archer.json  (换皮+骨骼派生)
└─ "eva_darkknight"  → skin=variant_eva_dark, template=eva.json + overlay dark
```

---

## 7. Godot 4 集成规范

### 7.1 资源组织

```
Godot 项目根/
├─ res://spine/eva/
│   ├─ eva.json                  # Spine 4.x JSON（主模板）
│   ├─ eva.atlas                 # Spine 图集描述
│   ├─ eva.png                   # 主图集纹理
│   ├─ variants/
│   │   ├─ eva_mage.json         # 法师变体 JSON
│   │   ├─ eva_mage.atlas
│   │   ├─ eva_mage.png
│   │   ├─ eva_archer.json
│   │   ├─ eva_archer.atlas
│   │   └─ eva_archer.png
│   └─ animations/                # 可选：按层级拆分动画 JSON
│       ├─ idle.json
│       ├─ walk.json
│       └─ attack.json
├─ res://scripts/
│   ├─ avatar_base.gd            # 角色基类
│   ├─ avatar_eva.gd             # Eva 专用控制器
│   └─ face_controller.gd        # 表情切换管理器
└─ res://data/
    └─ avatar_variants.tres       # 变体配置表
```

### 7.2 节点结构（Godot 场景树）

```
EvaRoot (Node2D)
├─ SpineSprite                     # spine-godot 节点
│   └─ (Skeleton / AnimationState 由插件管理)
├─ AnimationController (Node)      # 控制 AnimationState.setAnimation
├─ FaceController (Node)           # 控制 Skeleton.setSkin
├─ EquipmentController (Node)      # 控制装备 Skin 叠加
└─ FXController (Node)             # 特效锚点
```

### 7.3 核心 GDScript 示例

**avatar_eva.gd**：

```gdscript
extends Node2D
class_name AvatarEva

@onready var spine_sprite: SpineSprite = $SpineSprite
@onready var face_controller: FaceController = $FaceController
@onready var equip_controller: EquipmentController = $EquipmentController

# === 动画接口 ===
func play_animation(anim_name: String, loop: bool = true) -> void:
    spine_sprite.animation_state.set_animation(anim_name, 0, loop)

# === 表情接口 ===
func set_face(face: String) -> void:
    face_controller.set_face(face)

# === 装备接口 ===
func equip(equip_id: String) -> void:
    equip_controller.equip(equip_id)

# === 变体接口（路径 A：换皮） ===
func apply_variant(variant_id: String) -> void:
    var data: AvatarVariant = AvatarVariantsDB.get(variant_id)
    if data.use_template != "":
        spine_sprite.skeleton_data_resource = load(data.use_template)
    equip_controller.apply_variant_skins(data.skins)

# === 通用事件 ===
func _on_animation_complete(entry: SpineAnimationStateTrackEntry) -> void:
    if entry.animation.name == "attack":
        play_animation("idle", true)
```

**face_controller.gd**：

```gdscript
extends Node
class_name FaceController

@export var spine_sprite_path: NodePath
var _base_skin: SpineSkin  # 缓存当前基础 skin（含装备）

@onready var spine_sprite: SpineSprite = get_node(spine_sprite_path)

func _ready():
    _base_skin = spine_sprite.skeleton.get_skin()

func set_face(face_name: String) -> void:
    var face_skin := spine_sprite.skeleton.data.find_skin(face_name)
    if face_skin == null:
        push_warning("Face skin not found: %s" % face_name)
        return
    # 在当前基础 skin 上叠加表情
    var combined := SpineSkin.new("runtime_face")
    combined.add_skin(_base_skin)
    combined.add_skin(face_skin)
    spine_sprite.skeleton.set_skin(combined)
```

### 7.4 Spine 编辑器导出规范（避免 Godot 导入失败）

| 选项 | 设置 | 原因 |
|------|------|------|
| 格式 | **JSON** | Godot 兼容（不要选 Binary） |
| 纹理打包 | **Atlas** | 单图集 + `.atlas` 描述文件 |
| 关键帧压缩 | ✅ 开启 | 减少 JSON 体积 |
| 非必要数据 | 关闭 | 仅导出需要的骨骼/动画 |
| 缩略图 | 关闭 | 不需要嵌入 |

---

## 8. 动画清单（按层级）

### L0 MVP 必选动画（3 个）

| 动画 | 时长 | 循环 | 备注 |
|------|------|------|------|
| `idle` | 2s | ✅ | 呼吸 + 轻微头部晃动 |
| `attack` | 0.6s | ❌ | 一次性挥砍 |
| `walk` | 0.8s | ✅ | 行走循环（L0 可暂时用原地踏步） |

### L1 推荐动画（+4 个）

| 动画 | 用途 |
|------|------|
| `run` | 跑步 |
| `cast` | 施法抬手 |
| `damage` | 受击（短促后退） |
| `face_idle` | 对话待机（眼睛微眨） |

### L2 完整动画（+6 个）

| 动画 | 用途 |
|------|------|
| `death` | 死亡 |
| `victory` | 胜利/嘲讽 |
| `defend` | 防御格挡 |
| `talk` | 说话嘴部张合 |
| `jump` | 起跳预备 |
| `land` | 落地缓冲 |

---

## 9. 文件交付清单

```
docs/
└─ eva_spine_design.md           ← 本文档

assets/eva/
├─ L0_mvp/
│   ├─ eva.json                   # 13骨 + 10 Slot + 1 Skin
│   ├─ eva.atlas
│   ├─ eva.png
│   └─ README.md                  # 落地说明
├─ L1_enhanced/
│   ├─ eva.json                   # 17骨 + 18 Slot + 7 Skin
│   └─ ...
├─ L2_full/
│   ├─ eva.json                   # 22骨 + 29 Slot + 13 Skin
│   ├─ variants/
│   │   └─ eva_mage.json          # 第一个异化变体
│   └─ ...
└─ L3_extended/
    └─ eva_archer.json            # 第一个骨骼派生变体
```

---

## 10. 验收标准

### L0 验收（必须通过）

- [ ] Godot 4 打开场景，Eva 立绘正确显示
- [ ] `idle` 动画流畅播放（呼吸节奏自然）
- [ ] `attack` 动画可触发，播完自动回到 idle
- [ ] `walk` 动画循环无明显接缝
- [ ] 帧率稳定 ≥ 60 FPS（即使 100 个实例同屏）

### L1 验收

- [ ] 通过代码切换 `face_angry` 表情即时生效
- [ ] 装备武器后，hand_L 跟随手臂运动
- [ ] 行走时 `boots_L/R` 跟随腿部摆动

### L2 验收

- [ ] 披风在快速移动时有自然摆动惯性
- [ ] 6 个表情切换流畅无视觉跳动
- [ ] 加载 `variant_eva_mage` 后，Eva 自动变成法师外观

### L3 验收

- [ ] `eva_archer` 模板独立加载并正常显示
- [ ] 弓手变体没有披风 Slot（已通过骨骼派生移除）
- [ ] 数据表 `avatar_variants.tres` 可运行时动态切换

---

## 11. 迭代路线图

```
Week 1   L0 MVP        落地 13骨 + 3动画 + Godot 流水线
Week 2   L0 → L1       加 chest/neck/forearm + 装备换装
Week 3   L1 → L2       加披风链 + 表情拆分 + 第一个异化 Skin
Week 4   L2 → L3       派生第一个骨骼变体，验证扩展机制
Week 5+  持续扩展      按需增加角色/动画/特效
```

---

## 12. 待确认事项

- [ ] **Eva 是否需要 IK？**（脚部贴合地形 / 双手持武器）
- [ ] **披风是否上 Physics Constraint？**（Godot 4 支持 mesh 物理，可作披风 cloth 替代）
- [ ] **是否需要 Mesh Attachment？**（用于显示 3D 装备如发光剑刃）
- [ ] **异化变体的美术工作流**：由美术切多套图，还是程序动态上色？

---

**文档结束。如需进入下一步，建议先做 L0 MVP（13 骨 + 3 动画）的 Spine 模板文件，把 Godot 流水线打通。**
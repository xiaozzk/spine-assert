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
| **拆** | Slot + Attachment | 武器、装备、发型、表情结构 | 美术 / 程序 |
| **换** | Skin 切换 | 装备流派、表情状态、阵营色 | 美术 / 剧情 |

> 🎯 **黄金法则**：必须动的用骨骼，能拆的用 Slot，能换的用 Skin。  
> 表情 = 拆 + 换：先把头部拆成 eyebrow / eye / mouth 五个 Slot（§4.3），再由 `face_*` Skin 在这些 Slot 上选贴图组合（§5.5）。

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

### 3.1 L0 MVP —— 12 根 [必选]

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

### 3.2 L1 增强 —— 18 根（+6）[推荐]

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

**L0 → L1 新增 6 根**：chest × 1、neck × 1、forearm_L × 1、forearm_R × 1、foot_L × 1、foot_R × 1  
**新增能力**：呼吸缩放、行走循环、武器挂载、表情 Skin 切换  
**新增动画**：walk、run、cast  
**新增 IK**：脚部 IK（§3.5.1，+2 隐藏目标骨）

### 3.3 L2 完整 —— 24 根（+6）[推荐]

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

**L1 → L2 新增 6 根**：jaw × 1、shoulder_L × 1、shoulder_R × 1、cloak_root × 1、cape_1 × 1、cape_2 × 1  
**新增能力**：披风链惯性摆动（纯骨骼链，**不挂物理**，见 §12 决策 #2）、说话口型、独立转身

### 3.4 L3 扩展 —— 30 根（+6）[可选]

**L2 → L3 新增 6 根**：
- 头发链：`hair_root → hair_back_1 → hair_back_2`（×3）
- 武器槽：`weapon_root_L / weapon_root_R`（×2，独立于 hand，避免旋转污染）
- 特效锚点：`FX_root`（×1，绑 hand_R 或 chest）

### 3.5 IK 方案（脚部 L1 / 双手武器 L2）

**IK 类型**：Spine 4.x 内置 **TwoBoneIKConstraint**。  
L1 落地脚部 IK（运行时驱动）；L2 落地双手武器 IK（烘焙到动画里，不做运行时 IK）。L0 不挂 IK。

#### 3.5.1 L1 脚部 IK [推荐]

- **骨骼**：新增 2 个隐藏目标骨 `ik_target_foot_L / ik_target_foot_R`（不参与绘制）
- **约束**：2 个 `IkConstraint`，分别作用于 `thigh → shin → foot` 链，目标 = 对应 `ik_target_foot_*`
- **运行时**：每帧从地形读取脚底 Y，平移到 `ik_target_foot_*` 后调用 `skeleton.update_world_transforms()`
- **适用动画**：`walk` / `run` / `idle` / `cast`；`attack` 不走 IK（落地姿态由美术手 K）

#### 3.5.2 L2 双手武器 IK [推荐]

- **场景**：双手大剑 / 弓 / 长杖 —— off hand（左手）需 IK 到主手武器上
- **实现**：在 Spine 编辑器对 `upperArm_L → forearm_L → hand_L` 链施加 IK 约束，目标 = `weapon_root_R` 上的虚拟锚点骨，**美术手 K 关键姿态的 IK 目标位置**
- **运行时不动 IK 目标** —— 每个武器对应独立动画切片（`attack_greatsword` / `draw_bow` / `cast_staff`），换武器时**动画名跟着切**，而不是同一动画 + 运行时重解算（避免「手抖一帧」）
- **不采用运行时 IK**：避免换武器瞬间的抖动 + 不同武器姿态差异巨大美术烘焙更稳

#### 3.5.3 L0 不挂 IK

L0 阶段不引入任何 IK 约束，骨骼结构、动画、运行时一律无 IK。

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

### 4.3 L1 增强 —— 20 个 Slot（+10）[推荐]

**L0 → L1 新增 10 个 Slot**：
- 装备：`wristband_L` / `wristband_R`（护腕）、`breastpin`（胸针）、`belt`（腰带）、`weapon_L`（武器挂点）
- **表情拆分**（表情也用 Slot 实现，见 §1）：
  - `eyebrow_L / eyebrow_R`、`eye_L / eye_R`、`mouth`

  > 这 5 个表情 Slot 持有多个 Attachment 候选（无表情/愤怒/微笑… 的眉毛、眼、嘴贴图），由 `face_*` Skin 决定每个 Slot 当前显示哪一个。

### 4.4 L2 完整 —— 29 个 Slot（+9）[推荐]

**L1 → L2 新增 9 个 Slot**：
- **拆分**：`hair_front` → `hair_front_L` + `hair_front_R`（+1）
- **新增**：`body_skin`（+1）、`body_sub`（+1）、`cape_lining`（+1）、`cape_decor`（+1）、`hair_side_L` / `hair_side_R`（+2）、`weapon_R`（+1）、`FX_root`（+1）

完整 Slot 表（按类别）：

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

### 5.4 L2 完整 —— 14 个 Skin（+7）[推荐]

**L1 → L2 新增 7 个 Skin**：
- **表情 +4**：`face_smile`、`face_surprise`、`face_pain`、`face_dead`（加上 L1 已有 normal/angry 共 6 表情）
- **装备 +2**：`equip_cape_black`、`equip_cape_purple`
- **异化 +1**：`variant_eva_mage`

**完整 Skin 清单（14 个）**：
- 基础：`default`
- 表情（6）：`face_normal`, `face_angry`, `face_smile`, `face_surprise`, `face_pain`, `face_dead`
- 装备（6）：`equip_cape_red`, `equip_cape_blue`, `equip_cape_black`, `equip_cape_purple`, `equip_weapon_sword`, `equip_weapon_staff`
- 异化（1）：`variant_eva_mage`

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

### 6.4 异化扩展的运行时数据驱动（L3 阶段补充，先不实现）

为了支持**策划配置驱动变体**，不要在代码里写死 Skin 名称。用一张资源表描述每个变体的「模板 + 叠加 Skin 列表」：

```
res://data/avatar_variants.tres
├─ "eva_default"     → skin=default,          template=eva.json
├─ "eva_mage"        → skin=variant_eva_mage, template=eva.json
├─ "eva_archer"      → skin=default,          template=eva_archer.json  (换皮+骨骼派生)
└─ "eva_darkknight"  → skin=variant_eva_dark, template=eva.json
```

> ⏳ 此节为 L3 阶段补充。L0/L1/L2 阶段直接调 `set_skin()` 即可，不需要这张表。

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
├─ SpineSprite                     # spine-godot 节点（Skeleton / AnimationState 由插件管理）
├─ AnimationController (Node)      # L0：控制 AnimationState.setAnimation
├─ FaceController (Node)           # L1：控制表情 Skin 叠加
├─ EquipmentController (Node)      # L1：控制装备 Skin 叠加
└─ FXController (Node)             # L3：特效锚点 / 变体切换（视实际需求引入）
```

> 节点按层级引入 —— L0 场景只有 `SpineSprite` + `AnimationController`，避免一上来就堆 4 个空 Controller。

### 7.3 核心 GDScript 示例

> 按层级提供最小可用代码：L0 只用动画接口，L1 加入表情/装备接口。变体（apply_variant）是 L3 接口，见 §6.4。

**avatar_eva.gd**（L0 起步，L1 扩展）：

```gdscript
extends Node2D
class_name AvatarEva

@onready var spine_sprite: SpineSprite = $SpineSprite
@onready var face_controller: FaceController = $FaceController          # L1
@onready var equip_controller: EquipmentController = $EquipmentController  # L1

# === 动画接口（L0） ===
func play_animation(anim_name: String, loop: bool = true) -> void:
    spine_sprite.animation_state.set_animation(anim_name, 0, loop)

# === 表情接口（L1） ===
func set_face(face: String) -> void:
    face_controller.set_face(face)

# === 装备接口（L1） ===
func equip(equip_id: String) -> void:
    equip_controller.equip(equip_id)

# === 通用事件（L0） ===
func _on_animation_complete(entry: SpineAnimationStateTrackEntry) -> void:
    if entry.animation.name == "attack":
        play_animation("idle", true)
```

**face_controller.gd**（L1 引入）：

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
├─ L0_mvp/                       # 必选
│   ├─ eva.json                   # 12骨 + 10 Slot + 1 Skin（无 IK）
│   ├─ eva.atlas
│   ├─ eva.png
│   └─ README.md                  # 落地说明
├─ L1_enhanced/                  # 推荐
│   ├─ eva.json                   # 18骨 + 20 Slot + 7 Skin（含脚部 IK）
│   └─ ...
├─ L2_full/                      # 推荐
│   ├─ eva.json                   # 24骨 + 29 Slot + 14 Skin（含披风链 + 双手武器 IK 烘焙）
│   ├─ variants/
│   │   └─ eva_mage.json          # 第一个异化变体
│   └─ ...
└─ L3_extended/                  # 可选
    └─ eva_archer.json            # 30骨 + 第一个骨骼派生变体
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
Week 1   L0 MVP        落地 12骨 + 10 Slot + 1 Skin + 3动画 + Godot 流水线（无 IK）
Week 2   L0 → L1       +6骨 +10 Slot +6 Skin +4动画 + 脚部 IK（§3.5.1）
Week 3   L1 → L2       +6骨 +9 Slot +7 Skin +6动画 + 披风链（无物理）+ 双手武器 IK 烘焙（§3.5.2）
Week 4   L2 → L3       +6骨（头发链/武器槽/特效锚点）+ 派生第一个骨骼变体 + 变体数据表（§6.4）
Week 5+  持续扩展      按需增加角色/动画/特效
```

---

## 12. 已确认设计决策

| # | 决策项 | 结论 | 落地影响 |
|---|--------|------|---------|
| 1 | **IK**（脚部贴合地形 / 双手持武器） | ✅ **需要** | 见 §3.5 —— 脚部 IK 在 **L1** 落地（2 个 IK 约束 + 2 个目标骨）；双手武器 IK 在 **L2** 落地（off-hand IK 烘焙到动画里，不做运行时 IK） |
| 2 | **披风物理**（Physics Constraint / Mesh 物理） | ❌ **先不启用**（保持精简） | L2 披风完全靠骨骼链摆动 + 关键帧模拟「惯性」，代码侧不挂任何物理约束。刚体/物理留待真有需求再加，避免引入物理不确定性 |
| 3 | **Mesh Attachment**（3D 装备如发光剑刃） | ❌ **先不启用**（2D 项目保持精简） | 武器/装备只用 Region Attachment；不挂 3D Mesh、不做发光剑刃之类的 3D 效果。Mesh Attachment 类型本身保留，但不主动用它做 3D 渲染 |
| 4 | **异化美术工作流** | ✅ **美术切多套图**（异体美术延后实现） | 按 §6 路径 A 推进 —— 每个变体由美术切完整一套图（含武器/装备/表情变体），程序只做 Skin 叠加；运行时上色 / 调色板动态换色方案**先不实现**，作为未来扩展项 |

> 💡 决策时间点：v1.0 拍板，作为后续迭代的基线。如要变更需走文档变更记录。

---

**文档结束。如需进入下一步，建议先做 L0 MVP（12 骨 + 10 Slot + 1 Skin + 3 动画）的 Spine 模板文件，把 Godot 流水线打通。**
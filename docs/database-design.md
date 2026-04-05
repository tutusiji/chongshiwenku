# 崇实文库数据库设计文档

## 1. 文档信息

- 文档名称：崇实文库数据库设计文档
- 当前版本：V1.1 草案
- 编写日期：2026-04-06
- 适用阶段：数据库建模、接口开发、权限实现

## 2. 设计目标

数据库设计需要满足以下目标：

- 支撑多用户注册、登录和个人资料维护
- 支撑资料组创建、成员管理和组内共享
- 支撑文档上传、版本管理、在线预览和下载
- 支撑文档与资料组的统一权限模型
- 支撑阅读量、点赞、投币、签到与积分流水
- 支撑后续扩展审计日志、搜索索引、收藏评论等能力

## 3. 设计原则

### 3.1 单一主数据库

首版采用 PostgreSQL 作为唯一主数据库，避免 MySQL 与 PostgreSQL 双写和双维护复杂度。

### 3.2 业务数据与文件数据分离

- 数据库只存元数据、权限、状态、互动数据和积分流水
- 原始文件、封面图、预览 PDF、缩略图等存对象存储

### 3.3 资源权限统一抽象

组和文档共用统一的可见性枚举与 ACL 授权表，避免出现两套权限模型并存。

### 3.4 账户快照 + 流水留痕

- 用户当前积分余额存放在账户表
- 所有积分变动写入流水表
- 余额查询走账户表，审计追溯走流水表

### 3.5 聚合统计与明细记录并存

- 文档主表保留 `read_count`、`like_count`、`coin_count` 等聚合字段
- 点赞、投币、签到等行为同时保留明细表，支持审计和风控

## 4. 主键与通用字段约定

### 4.1 主键

- 主要业务表使用 `UUID` 作为主键
- 便于后续多服务拆分、对象存储回调和外部引用

### 4.2 时间字段

核心表统一包含：

- `created_at`
- `updated_at`

部分表根据业务需要增加：

- `deleted_at`
- `last_login_at`
- `checked_in_at`
- `processed_at`

### 4.3 命名规范

- 表名采用复数下划线风格，例如 `group_members`
- 布尔字段采用 `is_` 或 `allow_` 前缀
- 枚举字段以 `_mode`、`_status`、`_type` 结尾

## 5. 核心枚举设计

### 5.1 用户状态 `user_status`

- `pending`
- `active`
- `disabled`
- `banned`

### 5.2 资源可见性 `resource_visibility`

- `public`
- `password`
- `owner_only`
- `group_members`
- `specific_users`

### 5.3 资源状态 `resource_status`

- `active`
- `hidden`
- `archived`
- `deleted`

### 5.4 组成员角色 `group_role`

- `owner`
- `admin`
- `member`

### 5.5 文档预览状态 `document_preview_status`

- `pending`
- `processing`
- `ready`
- `failed`

### 5.6 文档资源类型 `document_asset_kind`

- `original`
- `preview_pdf`
- `cover_image`
- `thumbnail`
- `extracted_text`

### 5.7 ACL 主体类型 `acl_subject_type`

- `user`
- `group_role`

### 5.8 ACL 权限类型 `acl_permission_type`

- `view`
- `download`
- `manage`

### 5.9 积分流水来源 `coin_ledger_source`

- `register_bonus`
- `daily_checkin_reward`
- `upload_reward`
- `document_coin_spend`
- `document_coin_income`
- `admin_adjustment`

## 6. 核心表设计

### 6.1 用户域

#### 6.1.1 `users`

用户主表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | UUID PK | 用户主键 |
| `username` | varchar(64) | 登录名，唯一 |
| `email` | varchar(255) | 邮箱，唯一，可空 |
| `phone` | varchar(32) | 手机号，唯一，可空 |
| `password_hash` | varchar(255) | 密码哈希 |
| `nickname` | varchar(80) | 昵称 |
| `avatar_url` | varchar(512) | 头像地址 |
| `bio` | text | 个人简介 |
| `status` | user_status | 用户状态 |
| `last_login_at` | timestamptz | 最近登录时间 |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

索引建议：

- 唯一索引：`username`
- 唯一索引：`email`
- 唯一索引：`phone`
- 普通索引：`status`

#### 6.1.2 `user_coin_accounts`

用户积分账户表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | UUID PK | 主键 |
| `user_id` | UUID FK | 用户 ID，唯一 |
| `balance` | integer | 当前余额 |
| `total_earned` | integer | 累计获得 |
| `total_spent` | integer | 累计消耗 |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

约束建议：

- 唯一约束：`user_id`

#### 6.1.3 `coin_ledgers`

积分流水表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | UUID PK | 主键 |
| `user_id` | UUID FK | 用户 ID |
| `change_amount` | integer | 本次变动值，可正可负 |
| `balance_after` | integer | 变动后余额 |
| `source_type` | coin_ledger_source | 来源类型 |
| `related_document_id` | UUID FK nullable | 关联文档 |
| `related_user_id` | UUID FK nullable | 关联用户，例如投币接收方 |
| `remark` | varchar(255) nullable | 备注 |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

索引建议：

- 普通索引：`user_id`
- 普通索引：`source_type`
- 普通索引：`related_document_id`

#### 6.1.4 `user_checkins`

用户签到表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | UUID PK | 主键 |
| `user_id` | UUID FK | 用户 ID |
| `checkin_date` | date | 自然日 |
| `reward_coins` | integer | 当次奖励，默认 2 |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

约束建议：

- 唯一约束：`user_id + checkin_date`

### 6.2 资料组域

#### 6.2.1 `groups`

资料组主表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | UUID PK | 组主键 |
| `owner_id` | UUID FK | 组拥有者 |
| `name` | varchar(120) | 组名称 |
| `slug` | varchar(140) | 对外标识，唯一 |
| `description` | text | 组简介 |
| `cover_url` | varchar(512) | 封面图 |
| `visibility_mode` | resource_visibility | 可见性 |
| `status` | resource_status | 状态 |
| `allow_member_invite` | boolean | 是否允许成员邀请 |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

索引建议：

- 普通索引：`owner_id`
- 唯一索引：`slug`
- 组合索引：`status, visibility_mode`

#### 6.2.2 `group_members`

组成员关系表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | UUID PK | 主键 |
| `group_id` | UUID FK | 资料组 ID |
| `user_id` | UUID FK | 用户 ID |
| `role` | group_role | 在组内的角色 |
| `joined_at` | timestamptz | 加入时间 |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

约束建议：

- 唯一约束：`group_id + user_id`

### 6.3 文档域

#### 6.3.1 `documents`

文档主表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | UUID PK | 文档主键 |
| `owner_id` | UUID FK | 上传者 |
| `group_id` | UUID FK nullable | 所属组，可空 |
| `title` | varchar(255) | 标题 |
| `summary` | text | 简介 |
| `category` | varchar(80) | 分类 |
| `file_type` | varchar(32) | 业务类型，例如 pdf/docx/xlsx/pptx |
| `mime_type` | varchar(120) | MIME 类型 |
| `file_extension` | varchar(20) | 后缀名 |
| `file_size` | bigint | 当前有效版本大小 |
| `visibility_mode` | resource_visibility | 文档可见性 |
| `status` | resource_status | 文档状态 |
| `preview_status` | document_preview_status | 预览状态 |
| `allow_download` | boolean | 是否允许下载 |
| `read_count` | bigint | 阅读次数 |
| `like_count` | bigint | 点赞总数 |
| `coin_count` | bigint | 累计投币数 |
| `download_count` | bigint | 下载次数 |
| `extra_metadata` | jsonb | 扩展元数据 |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

索引建议：

- 普通索引：`owner_id`
- 普通索引：`group_id`
- 组合索引：`status, visibility_mode`
- 组合索引：`preview_status, status`
- GIN 索引：`extra_metadata`

#### 6.3.2 `document_versions`

文档版本表，用于支持替换上传和版本留痕。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | UUID PK | 主键 |
| `document_id` | UUID FK | 文档 ID |
| `version_number` | integer | 版本号，从 1 开始 |
| `file_name` | varchar(255) | 原文件名 |
| `storage_key` | varchar(512) | 原始文件对象存储 Key |
| `checksum` | varchar(128) | 文件校验值 |
| `file_size` | bigint | 文件大小 |
| `uploaded_at` | timestamptz | 上传时间 |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

约束建议：

- 唯一约束：`document_id + version_number`

#### 6.3.3 `document_assets`

预览产物表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | UUID PK | 主键 |
| `document_id` | UUID FK | 文档 ID |
| `document_version_id` | UUID FK | 文档版本 ID |
| `asset_kind` | document_asset_kind | 资源类型 |
| `storage_key` | varchar(512) | 对象存储 Key |
| `content_type` | varchar(120) | 内容类型 |
| `page_count` | integer | 页数，可空 |
| `asset_order` | integer | 顺序，例如缩略图页码 |
| `extra_metadata` | jsonb | 宽高、页码等扩展信息 |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

#### 6.3.4 `document_likes`

文档点赞表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | UUID PK | 主键 |
| `document_id` | UUID FK | 文档 ID |
| `user_id` | UUID FK | 点赞用户 ID |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

约束建议：

- 唯一约束：`document_id + user_id`

#### 6.3.5 `document_coin_records`

文档投币记录表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | UUID PK | 主键 |
| `document_id` | UUID FK | 文档 ID |
| `sender_user_id` | UUID FK | 投币用户 |
| `receiver_user_id` | UUID FK | 收币用户，通常为文档所有者 |
| `coin_amount` | integer | 投币数量 |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

索引建议：

- 普通索引：`document_id`
- 普通索引：`sender_user_id`
- 普通索引：`receiver_user_id`

### 6.4 权限域

#### 6.4.1 `acl_entries`

资源授权表，用于“指定用户可见”“组角色可管理”等场景。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | UUID PK | 主键 |
| `resource_type` | varchar(32) | `group` 或 `document` |
| `resource_id` | UUID | 资源 ID |
| `subject_type` | acl_subject_type | 主体类型 |
| `subject_id` | UUID nullable | 主体 ID，面向用户授权时使用 |
| `subject_key` | varchar(64) nullable | 主体标识，例如组角色 |
| `permission_type` | acl_permission_type | 权限类型 |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

#### 6.4.2 `access_passcodes`

密码访问配置表，用于“密码访问”的组或文档。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | UUID PK | 主键 |
| `resource_type` | varchar(32) | `group` 或 `document` |
| `resource_id` | UUID | 资源 ID |
| `password_hash` | varchar(255) | 密码哈希 |
| `hint` | varchar(120) | 密码提示，可空 |
| `is_enabled` | boolean | 是否启用 |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

约束建议：

- 唯一约束：`resource_type + resource_id`

### 6.5 搜索与标签域

#### 6.5.1 `document_tags`

标签字典表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | UUID PK | 主键 |
| `name` | varchar(64) | 标签名 |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

#### 6.5.2 `document_tag_relations`

文档与标签关系表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | UUID PK | 主键 |
| `document_id` | UUID FK | 文档 ID |
| `tag_id` | UUID FK | 标签 ID |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

约束建议：

- 唯一约束：`document_id + tag_id`

### 6.6 任务与日志域

#### 6.6.1 `preview_jobs`

预览转换任务表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | UUID PK | 主键 |
| `document_id` | UUID FK | 文档 ID |
| `document_version_id` | UUID FK | 文档版本 ID |
| `status` | varchar(32) | `pending/processing/success/failed` |
| `attempt_count` | integer | 重试次数 |
| `error_message` | text | 错误信息 |
| `started_at` | timestamptz | 开始时间 |
| `finished_at` | timestamptz | 结束时间 |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

#### 6.6.2 `download_logs`

下载日志表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | UUID PK | 主键 |
| `document_id` | UUID FK | 文档 ID |
| `user_id` | UUID FK nullable | 下载用户，可空 |
| `ip_address` | inet | IP 地址 |
| `user_agent` | text | UA |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

#### 6.6.3 `audit_logs`

审计日志表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | UUID PK | 主键 |
| `operator_id` | UUID FK nullable | 操作者 |
| `action` | varchar(64) | 操作动作 |
| `resource_type` | varchar(32) | 资源类型 |
| `resource_id` | UUID nullable | 资源 ID |
| `payload` | jsonb | 变更快照 |
| `created_at` | timestamptz | 创建时间 |
| `updated_at` | timestamptz | 更新时间 |

## 7. 核心关系说明

### 7.1 用户与组

- 一个用户可以创建多个组
- 一个组只能有一个拥有者
- 一个用户可加入多个组
- 一个组可包含多个成员

### 7.2 用户与文档

- 一个用户可以上传多个文档
- 一个文档只能有一个所有者

### 7.3 用户与积分

- 一个用户有且仅有一个积分账户
- 一个用户可以有多条积分流水
- 一个用户每天最多有一条签到记录

### 7.4 文档与互动

- 一个文档可被多个用户点赞
- 一个用户对同一文档最多保留一条点赞记录
- 一个文档可被多次投币
- 一个文档保存聚合阅读量、点赞量和投币量

### 7.5 组与文档

- 一个组可以包含多个文档
- 一个文档可不属于任何组
- 文档归组后，文档权限不能突破组权限边界

### 7.6 文档与版本

- 一个文档对应多个历史版本
- 当前前台默认展示最新有效版本

## 8. 权限与积分模型落库规则

### 8.1 公开资源

- `visibility_mode = public`
- 可不需要 `acl_entries`
- 可不需要 `access_passcodes`

### 8.2 密码访问资源

- `visibility_mode = password`
- 在 `access_passcodes` 中保存密码哈希

### 8.3 仅自己可见

- `visibility_mode = owner_only`
- 依赖资源的 `owner_id` 做访问判断

### 8.4 组内可见

- `visibility_mode = group_members`
- 对文档来说要求存在合法 `group_id`
- 访问由 `group_members` 表判定

### 8.5 指定用户可见

- `visibility_mode = specific_users`
- 通过 `acl_entries` 为具体用户授予 `view` 权限

### 8.6 注册奖励

- 用户注册成功后，创建 `user_coin_accounts`
- 初始 `balance = 100`
- 写入一条 `coin_ledgers`，`source_type = register_bonus`

### 8.7 上传奖励

- 文档上传成功后写入上传奖励流水
- 对应账户余额增加 10
- 奖励逻辑需保证同一文档上传完成回调不重复发放

### 8.8 每日签到

- `user_checkins` 以 `user_id + checkin_date` 做唯一约束
- 签到成功后增加 2 币并写入流水

### 8.9 文档投币

- 发起投币时扣减 `sender_user_id` 余额
- 文档 `coin_count` 增加投币数量
- 记录一条 `document_coin_records`
- 至少写入投币人支出流水
- 若平台定义为创作者收币，则同时给 `receiver_user_id` 增加对应余额并写入收入流水

## 9. 索引与性能建议

### 9.1 基础索引

- 所有外键字段建立普通索引
- 高频筛选状态字段建立组合索引

### 9.2 搜索优化

V1 建议使用 PostgreSQL 全文检索，可在 `documents` 表外扩展专用搜索字段或物化视图：

- `title`
- `summary`
- 抽取文本
- 标签名

### 9.3 热点查询

重点优化以下查询：

- 某用户上传文档列表
- 某组内文档列表
- 公开文档最新列表
- 指定用户可见文档列表
- 文档详情 + 当前版本 + 预览资源
- 用户积分余额与最近流水
- 用户当日是否已签到

## 10. 分库分表建议

V1 不建议提前分库分表，但建议预留以下演进方向：

- 超大日志表可按月分区
- 搜索可独立迁移到 Elasticsearch/OpenSearch
- 审计和下载日志可迁移到分析型存储
- 积分流水可按月分区，降低大表压力

## 11. 与代码实现的映射建议

建议以后端 ORM 模型作为应用层数据源，以数据库迁移脚本作为结构变更的最终落地方式：

- 文档设计是产品与研发对齐基线
- ORM 模型承载日常开发
- Alembic 迁移脚本承载真实数据库演进

## 12. 当前结论

崇实文库首版数据库建议至少落地以下主表：

- `users`
- `user_coin_accounts`
- `coin_ledgers`
- `user_checkins`
- `groups`
- `group_members`
- `documents`
- `document_versions`
- `document_assets`
- `document_likes`
- `document_coin_records`
- `acl_entries`
- `access_passcodes`
- `preview_jobs`
- `download_logs`
- `audit_logs`

这套模型能够支撑首版“上传、分组、预览、下载、密码访问、组内访问、指定用户访问、阅读量、点赞、投币、签到、积分流水”的关键业务闭环。

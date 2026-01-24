# Vocab Highlighter - 生词标记插件

> 浏览网页时自动标记生词，点击即可学习。支持四六级/雅思/托福分级冷启动，Supabase 云同步，点击时自动保存上下文句子。

---

## 核心功能

### 1. 智能生词标记
- 自动扫描网页上的所有英文单词
- 不在词汇表中的单词显示 **淡橙色点状下划线**
- 鼠标悬停时高亮显示
- 支持动态加载内容（SPA 页面）

### 2. 一键学习 + 上下文保存
- **点击生词** 即可标记为"已认识"
- 自动提取该单词所在的句子，存入数据库 `context` 字段
- 下划线消失 + 粒子动画反馈，页面上相同单词同步更新
- 底部 Toast 提示确认

### 3. 考试分级冷启动
首次使用选择你熟悉的考试和分数，词汇表从服务器按需加载：

| 考试 | 可选分数 | 词汇量范围 |
|------|---------|-----------|
| **四级** | 没过 / 425 / 500 / 550+ | 2,000 ~ 4,800 |
| **六级** | 没过 / 425 / 500 / 550+ | 4,800 ~ 7,500 |
| **雅思** | 5.5 / 6.0 / 6.5 / 7.0+ | 4,000 ~ 9,000 |
| **托福** | 60 / 80 / 100+ | 4,500 ~ 8,500 |

词汇表存储在 Supabase `vocab_levels` 表中，按需拉取，不打包进扩展。

### 4. 自定义词汇表
- 支持导入 `.txt` 文件（每行一个单词）
- 可追加导入，与现有词汇合并

### 5. 云同步（Supabase）
- 注册/登录后，新学习的单词自动同步到云端
- **登录即拉取**：登录后自动从云端拉取已有词汇，无缝切换设备
- **Local-First**：离线可用，联网时自动推送
- 冲突解决：服务器 `updated_at` 时间戳为准

### 6. 每日例句（AI 自动生成）
- 每天 22:00（UTC+8）自动触发
- 将当日新学单词组成一个连贯英语段落（3-5 句小故事）
- 附带中文翻译，目标单词在弹窗中高亮显示
- 基于 Supabase Edge Function + pg_cron + OpenRouter

---

## 数据同步架构

```
Content Script ──(sendMessage + context)──→ Background SW ──(push)──→ Supabase
     ↑                                          ↑                        │
     │                                          │                        │
chrome.storage.local ←──(写入)──────────────────┘                        │
     ↑                                                                   │
     └──────────────────(pull on login/startup)──────────────────────────┘

vocab_levels 表 ←──(冷启动选级别时拉取)──── popup.js
pg_cron (22:00 UTC+8) → Edge Function → AI → daily_sentences 表
```

**核心规则**：
1. content.js **从不**等待网络请求，仅通过 `sendMessage` 通知 background
2. 点击单词 → 提取上下文句子 → background 立即写本地 → 异步推送服务器（含 context）
3. 登录/启动 → 拉取服务器数据 → 合并到本地 → 自动设置 `initialized`
4. 冷启动选级别 → 从 `vocab_levels` 表按需拉取词汇 → 写入本地

---

## 开发

### 前置条件
- Node.js 18+
- npm

### 安装依赖
```bash
npm install
```

### 开发模式
```bash
npm run dev
```
然后在 `chrome://extensions` 中加载 `dist/` 文件夹。

### 生产构建
```bash
npm run build
```

### 环境变量
在项目根目录创建 `.env`：
```
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## 文件结构

```
vocab-highlighter/
├── src/
│   ├── background.js        # Service Worker: 消息处理 + 云同步（含 context）
│   ├── content.js           # Content Script: 页面扫描、标记、点击 + 句子提取
│   ├── content.css          # 生词下划线 + Toast + 粒子动画样式
│   ├── popup.html           # 弹窗界面（考试选级 + 认证 + 统计 + 管理）
│   ├── popup.js             # 弹窗交互: 考试分级、认证、词汇管理
│   ├── popup.css            # 弹窗样式（温暖极简 UI）
│   └── lib/
│       └── supabaseClient.js  # Supabase 客户端 (chrome.storage.local 适配)
├── manifest.json            # Manifest V3 配置
├── vite.config.js           # Vite + CRXJS 构建配置
├── schema.sql               # 数据库 DDL (user_vocab + daily_sentences + vocab_levels)
├── package.json
└── .env                     # 环境变量（不入库）
```

---

## 数据库 Schema

### user_vocab
| 字段 | 类型 | 说明 |
|------|------|------|
| user_id | uuid | 用户 ID (FK → auth.users) |
| word | text | 单词 |
| status | text | 状态 (known) |
| context | text | 该单词被标记时所在的句子 |
| updated_at | timestamptz | 最后更新时间（冲突解决依据） |
| is_deleted | boolean | 软删除标记 |

### vocab_levels
| 字段 | 类型 | 说明 |
|------|------|------|
| level | text (PK) | 级别 key（如 `cet4-425`, `ielts-6.5`） |
| words | jsonb | 该级别的完整词汇数组 |

### daily_sentences
| 字段 | 类型 | 说明 |
|------|------|------|
| user_id | uuid | 用户 ID |
| word | text | 逗号分隔的单词列表 |
| sentence | text | AI 生成的英语段落 |
| translation | text | 中文翻译 |
| created_date | date | 生成日期 (UTC+8) |

---

## 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| 扩展标准 | Manifest V3 | Chrome 扩展最新标准 |
| 构建工具 | Vite + @crxjs/vite-plugin | 模块化构建，HMR |
| 后端服务 | Supabase | 认证 + PostgreSQL + RLS + Edge Functions |
| AI 服务 | OpenRouter | 每日例句生成 |
| 定时任务 | pg_cron + pg_net | 每日触发 Edge Function |
| 数据策略 | Local-First | 离线优先，chrome.storage.local 为数据源 |

---

## 权限说明

| 权限 | 用途 |
|------|------|
| `storage` | 存储词汇表和学习记录 |
| `activeTab` | 刷新当前页面 |
| `host_permissions` | 连接 Supabase API 进行数据同步 |

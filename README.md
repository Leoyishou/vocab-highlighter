# Vocab Highlighter - 生词标记插件

> 浏览网页时自动标记生词，点击即可学习。基于 CEFR 欧洲语言标准。支持 Supabase 云同步，跨设备共享词汇进度。每日自动生成含新词的英语段落帮助巩固记忆。

---

## 核心功能

### 1. 智能生词标记
- 自动扫描网页上的所有英文单词
- 不在词汇表中的单词显示 **淡橙色点状下划线**
- 鼠标悬停时高亮显示
- 支持动态加载内容（SPA 页面）

### 2. 一键学习
- **点击生词** 即可标记为"已认识"
- 下划线立即消失 + 粒子动画反馈
- 页面上相同单词同步更新
- 底部 Toast 提示确认

### 3. CEFR 级别词汇表
首次使用可快速选择英语水平：

| 级别 | 描述 | 词汇量 |
|------|------|--------|
| A1 | 入门级 | ~500 词 |
| A2 | 基础级 | ~1,500 词 |
| **B1** | 中级 (推荐) | ~3,500 词 |
| B2 | 中高级 | ~6,000 词 |
| C1 | 高级 | ~10,000 词 |
| C2 | 精通级 | ~15,000 词 |

*词汇量为累积值，高级别包含低级别所有词汇*

### 4. 自定义词汇表
- 支持导入 `.txt` 文件（每行一个单词）
- 兼容中文词汇量文件格式
- 可追加导入，与现有词汇合并

### 5. 云同步（Supabase）
- 注册/登录后，新学习的单词自动同步到云端
- 跨设备（Chrome + 未来 iOS）共享词汇进度
- **Local-First**：离线可用，联网时自动推送
- 冲突解决：服务器 `updated_at` 时间戳为准

### 6. 每日例句（AI 自动生成）
- 每天晚上 10 点（UTC+8）自动触发
- 将当日所有新学单词组成**一个连贯英语段落**（3-5 句小故事）
- 附带完整中文翻译，目标单词在弹窗中高亮显示
- 基于 Supabase Edge Function + pg_cron + OpenRouter (Gemini 2.5 Flash)

### 7. 浏览行为追踪 + AI 日报
- 自动追踪页面停留时长（idle 时暂停计时）
- 每 5 分钟或 20 条记录批量上传到 Supabase
- 每日 06:00 UTC+8 生成 AI 浏览日报（时间分配、主题分析）
- 自动写入 Notion Database「Browsing Daily」

---

## 数据同步架构

```
Content Script ──(sendMessage)──→ Background SW ──(push)──→ Supabase
     ↑                                ↑                        │
     │                                │                        │
chrome.storage.local ←──(写入)────────┘                        │
     ↑                                                         │
     └──────────────────(pull on login/startup)────────────────┘

pg_cron (22:00 UTC+8) → Edge Function → OpenRouter AI → daily_sentences 表

browsingTracker.js ──(buffer 5min/20条)──→ Supabase browsing_records
pg_cron (06:00 UTC+8) → Edge Function → AI 日报 → daily_browsing_summaries + Notion
```

**核心规则**：
1. content.js **从不**等待网络请求，仅通过 `sendMessage` 通知 background
2. 点击单词 → background 立即写本地 → 异步推送服务器
3. 登录/启动 → 拉取服务器数据 → 合并到本地
4. 每日 22:00 UTC+8 → Edge Function 查询当日新词 → AI 生成段落 → 写入 daily_sentences

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
│   ├── background.js        # Service Worker: 消息处理 + 云同步 + 浏览追踪初始化
│   ├── browsingTracker.js   # 浏览行为追踪: tab 切换/idle 检测/buffer 上传
│   ├── content.js           # Content Script: 页面扫描、标记、点击交互
│   ├── content.css          # 生词下划线 + Toast + 粒子动画样式
│   ├── popup.html           # 弹窗界面（认证 + 统计 + 每日例句 + 管理）
│   ├── popup.js             # 弹窗交互: 认证、词汇管理、例句展示
│   ├── popup.css            # 弹窗样式（温暖极简 UI）
│   ├── vocabularies.js      # CEFR A1-C2 词汇数据
│   └── lib/
│       └── supabaseClient.js  # Supabase 客户端 (chrome.storage.local 适配)
├── public/icons/            # 插件图标 (16/48/128)
├── manifest.json            # Manifest V3 配置
├── vite.config.js           # Vite + CRXJS 构建配置
├── schema.sql               # 数据库 DDL (user_vocab + daily_sentences + browsing)
├── package.json
└── .env                     # 环境变量（不入库）
```

### Supabase 服务端资源（不在本仓库）
- **Edge Function**: `generate-daily-sentences` - AI 段落生成
- **Edge Function**: `daily-browsing-summary` - AI 浏览日报 + Notion 写入
- **pg_cron Job**: 每日 14:00 UTC (22:00 UTC+8) 触发 generate-daily-sentences
- **pg_cron Job**: 每日 22:00 UTC (06:00 UTC+8) 触发 daily-browsing-summary
- **数据库表**: `user_vocab`, `daily_sentences`, `browsing_records`, `daily_browsing_summaries`

---

## 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| 扩展标准 | Manifest V3 | Chrome 扩展最新标准 |
| 构建工具 | Vite + @crxjs/vite-plugin | 模块化构建，HMR |
| 后端服务 | Supabase | 认证 + PostgreSQL + RLS + Edge Functions |
| AI 服务 | OpenRouter (Gemini 2.5 Flash) | 每日例句生成 |
| 定时任务 | pg_cron + pg_net | 每日触发 Edge Function |
| 数据策略 | Local-First | 离线优先，chrome.storage.local 为数据源 |
| 模块系统 | ES Modules | 原生 import/export |

---

## 数据管理

| 功能 | 说明 |
|------|------|
| **追加导入** | 在现有词汇基础上添加新词 |
| **更换级别** | 切换 CEFR 级别，保留已学单词 |
| **导出新词** | 下载新认识的单词为 .txt 文件 |
| **清空新词** | 仅清除学习记录，保留基础词汇 |
| **重置数据** | 清空所有数据，回到初始状态 |

---

## 数据库 Schema

### user_vocab
| 字段 | 类型 | 说明 |
|------|------|------|
| user_id | uuid | 用户 ID (FK → auth.users) |
| word | text | 单词 |
| status | text | 状态 (known) |
| updated_at | timestamptz | 最后更新时间（冲突解决依据） |
| is_deleted | boolean | 软删除标记 |

### daily_sentences
| 字段 | 类型 | 说明 |
|------|------|------|
| user_id | uuid | 用户 ID |
| word | text | 逗号分隔的单词列表 |
| sentence | text | AI 生成的英语段落 |
| translation | text | 中文翻译 |
| created_date | date | 生成日期 (UTC+8) |

### browsing_records
| 字段 | 类型 | 说明 |
|------|------|------|
| user_id | uuid | 用户 ID |
| url | text | 页面 URL |
| title | text | 页面标题 |
| visit_time | timestamptz | 访问时间 |
| duration_seconds | integer | 停留时长(秒) |
| domain | text | 域名（方便聚合） |

### daily_browsing_summaries
| 字段 | 类型 | 说明 |
|------|------|------|
| user_id | uuid | 用户 ID |
| summary_date | date | 总结日期 |
| total_records | integer | 当日浏览页数 |
| total_duration_minutes | integer | 总时长(分钟) |
| top_domains | jsonb | Top 域名列表 |
| time_distribution | jsonb | 时段分布 |
| ai_summary | text | AI 生成的中文总结 |

---

## 权限说明

| 权限 | 用途 |
|------|------|
| `storage` | 存储词汇表和学习记录 |
| `activeTab` | 刷新当前页面 |
| `tabs` | 监听 tab 切换/更新，追踪浏览行为 |
| `idle` | 检测用户空闲状态，暂停计时 |
| `host_permissions` | 连接 Supabase API 进行数据同步 |

---

<p align="center">
  <b>让每次浏览都成为学习机会</b>
</p>




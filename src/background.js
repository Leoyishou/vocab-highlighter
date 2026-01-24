// Background Service Worker - Local-First Sync
import { supabase } from './lib/supabaseClient.js';

// 安装时初始化
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(['enabled'], (result) => {
    if (result.enabled === undefined) {
      chrome.storage.local.set({ enabled: true });
    }
  });
});

// 浏览器启动时尝试同步
chrome.runtime.onStartup.addListener(() => {
  pullFromServer();
});

// 监听认证状态变化 - 登录后立即拉取
supabase.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' && session) {
    pullFromServer();
  }
});

// ==================== Pull: 从服务器拉取并合并 ====================

async function pullFromServer() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const { data: serverWords, error } = await supabase
    .from('user_vocab')
    .select('word, status, updated_at, is_deleted')
    .eq('user_id', session.user.id);

  if (error || !serverWords) return;

  // 读取本地数据
  const local = await chrome.storage.local.get(['knownWords', 'importedWords', 'vocabMeta']);
  const knownWords = new Set(local.knownWords || []);
  const importedWords = new Set(local.importedWords || []);
  const vocabMeta = local.vocabMeta || {}; // { word: { updated_at } }

  // 合并: 服务器 updated_at 更新则以服务器为准
  for (const entry of serverWords) {
    const localMeta = vocabMeta[entry.word];
    const serverTime = new Date(entry.updated_at).getTime();
    const localTime = localMeta ? new Date(localMeta.updated_at).getTime() : 0;

    if (serverTime >= localTime) {
      if (entry.is_deleted || entry.status !== 'known') {
        // 服务器标记删除 → 本地也移除（不动 importedWords）
        if (!importedWords.has(entry.word)) {
          knownWords.delete(entry.word);
        }
      } else {
        // 服务器有此词 → 本地也加上
        knownWords.add(entry.word);
      }
      vocabMeta[entry.word] = { updated_at: entry.updated_at };
    }
  }

  const storageUpdate = {
    knownWords: [...knownWords],
    vocabMeta
  };

  // 如果从服务器拉到了词，标记已初始化
  if (knownWords.size > 0) {
    storageUpdate.initialized = true;
  }

  await chrome.storage.local.set(storageUpdate);

  // 通知所有标签页更新
  notifyTabs();
}

// ==================== Push: 异步推送到服务器 ====================

async function pushWordToServer(word, status = 'known', context = null) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return;

  const now = new Date().toISOString();
  const row = {
    user_id: session.user.id,
    word,
    status,
    updated_at: now,
    is_deleted: false
  };
  if (context) row.context = context;

  const { error } = await supabase
    .from('user_vocab')
    .upsert(row, { onConflict: 'user_id,word' });

  if (!error) {
    // 更新本地 meta
    const { vocabMeta } = await chrome.storage.local.get('vocabMeta');
    const meta = vocabMeta || {};
    meta[word] = { updated_at: now };
    await chrome.storage.local.set({ vocabMeta: meta });
  }
}

// ==================== 消息处理 ====================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'addWord') {
    // LOCAL-FIRST: 立即更新本地存储
    chrome.storage.local.get(['knownWords', 'importedWords'], (result) => {
      const words = result.knownWords || [];
      const importedWords = new Set(result.importedWords || []);

      if (!words.includes(request.word)) {
        words.push(request.word);
        chrome.storage.local.set({ knownWords: words }, () => {
          sendResponse({ success: true });
          // ASYNC: 仅同步非导入词
          if (!importedWords.has(request.word)) {
            pushWordToServer(request.word, 'known', request.context);
          }
        });
      } else {
        sendResponse({ success: true, exists: true });
      }
    });
    return true;
  }

  if (request.action === 'getVocabulary') {
    chrome.storage.local.get(['knownWords', 'enabled'], (result) => {
      sendResponse({
        knownWords: result.knownWords || [],
        enabled: result.enabled !== false
      });
    });
    return true;
  }

  if (request.action === 'triggerSync') {
    pullFromServer().then(() => sendResponse({ success: true }));
    return true;
  }

});

// ==================== 工具函数 ====================

function notifyTabs() {
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      chrome.tabs.sendMessage(tab.id, { action: 'vocabUpdated' }).catch(() => {});
    }
  });
}

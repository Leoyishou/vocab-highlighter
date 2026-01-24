// Popup Script with Cold Start Support & Micro-interactions
// 温暖极简 UI + 微成就感动画
import { supabase } from './lib/supabaseClient.js';

// 从服务器获取词汇表（直接按 level key 拉取）
async function fetchVocabulary(levelKey) {
  const { data, error } = await supabase
    .from('vocab_levels')
    .select('words')
    .eq('level', levelKey)
    .single();

  if (error || !data) return null;
  return Array.isArray(data.words) ? data.words : null;
}

document.addEventListener('DOMContentLoaded', () => {
  // 视图元素
  const setupView = document.getElementById('setupView');
  const mainView = document.getElementById('mainView');

  // 冷启动界面元素
  const setupImportBtn = document.getElementById('setupImportBtn');
  const setupFileInput = document.getElementById('setupFileInput');
  const examConfirmBtn = document.getElementById('examConfirmBtn');

  // 认证元素
  const authLogin = document.getElementById('authLogin');
  const authUser = document.getElementById('authUser');
  const authEmail = document.getElementById('authEmail');
  const authPassword = document.getElementById('authPassword');
  const loginBtn = document.getElementById('loginBtn');
  const signupBtn = document.getElementById('signupBtn');
  const logoutBtn = document.getElementById('logoutBtn');
  const userEmail = document.getElementById('userEmail');
  const authError = document.getElementById('authError');
  const syncStatus = document.getElementById('syncStatus');

  // 主界面元素
  const enableToggle = document.getElementById('enableToggle');
  const totalWordsEl = document.getElementById('totalWords');
  const learnedWordsEl = document.getElementById('learnedWords');
  const currentLevelEl = document.getElementById('currentLevel');
  const importBtn = document.getElementById('importBtn');
  const fileInput = document.getElementById('fileInput');
  const changeLevelBtn = document.getElementById('changeLevelBtn');
  const learnedList = document.getElementById('learnedList');
  const exportBtn = document.getElementById('exportBtn');
  const refreshBtn = document.getElementById('refreshBtn');
  const clearLearnedBtn = document.getElementById('clearLearnedBtn');
  const resetAllBtn = document.getElementById('resetAllBtn');

  // 检查是否已初始化
  checkInitialized();

  // ==================== 数字滚动动画 ====================
  function animateNumber(element, targetValue, duration = 600) {
    const startValue = parseInt(element.dataset.value) || 0;
    const startTime = performance.now();
    
    // 如果数值没变化，不执行动画
    if (startValue === targetValue) return;
    
    function update(currentTime) {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // 使用 easeOutExpo 缓动函数
      const easeProgress = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.round(startValue + (targetValue - startValue) * easeProgress);
      
      element.textContent = currentValue.toLocaleString();
      
      if (progress < 1) {
        requestAnimationFrame(update);
      } else {
        element.dataset.value = targetValue;
        // 完成时添加脉冲效果
        element.classList.add('counting');
        setTimeout(() => element.classList.remove('counting'), 300);
      }
    }
    
    requestAnimationFrame(update);
  }

  // ==================== 按钮点击反馈 ====================
  function addButtonFeedback(button) {
    button.addEventListener('click', function(e) {
      // 创建涟漪效果
      const ripple = document.createElement('span');
      ripple.style.cssText = `
        position: absolute;
        background: rgba(255,255,255,0.3);
        border-radius: 50%;
        transform: scale(0);
        animation: btnRipple 0.6s ease-out;
        pointer-events: none;
      `;
      
      const rect = this.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height);
      ripple.style.width = ripple.style.height = size + 'px';
      ripple.style.left = (e.clientX - rect.left - size/2) + 'px';
      ripple.style.top = (e.clientY - rect.top - size/2) + 'px';
      
      this.style.position = 'relative';
      this.style.overflow = 'hidden';
      this.appendChild(ripple);
      
      setTimeout(() => ripple.remove(), 600);
    });
  }

  // 为所有按钮添加反馈
  document.querySelectorAll('.btn').forEach(addButtonFeedback);

  // 添加涟漪动画样式
  const style = document.createElement('style');
  style.textContent = `
    @keyframes btnRipple {
      to {
        transform: scale(4);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);

  // ==================== 认证功能 ====================

  // 初始化认证状态
  async function initAuth() {
    const { data: { session } } = await supabase.auth.getSession();
    updateAuthUI(session);
  }

  // 监听认证状态变化
  supabase.auth.onAuthStateChange((_event, session) => {
    updateAuthUI(session);
    if (session) {
      loadDailySentences();
      // 登录后触发同步，拉取完成后会设置 initialized
      chrome.runtime.sendMessage({ action: 'triggerSync' });
    }
  });

  // 监听 storage 变化 - pull 完成后自动切换到主界面
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.initialized && changes.initialized.newValue) {
      checkInitialized();
    }
    if (namespace === 'local' && changes.knownWords && mainView.style.display !== 'none') {
      loadState();
    }
  });

  // 更新认证 UI
  function updateAuthUI(session) {
    if (session?.user) {
      authLogin.style.display = 'none';
      authUser.style.display = 'block';
      userEmail.textContent = session.user.email;
      syncStatus.textContent = '已连接';
      syncStatus.style.color = 'var(--success)';
    } else {
      authLogin.style.display = 'block';
      authUser.style.display = 'none';
    }
    authError.style.display = 'none';
  }

  // 显示认证错误
  function showAuthError(msg) {
    authError.textContent = msg;
    authError.style.display = 'block';
  }

  // 登录
  loginBtn.addEventListener('click', async () => {
    const email = authEmail.value.trim();
    const password = authPassword.value;
    if (!email || !password) {
      showAuthError('请输入邮箱和密码');
      return;
    }
    loginBtn.disabled = true;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    loginBtn.disabled = false;
    if (error) {
      showAuthError(error.message);
    }
  });

  // 注册
  signupBtn.addEventListener('click', async () => {
    const email = authEmail.value.trim();
    const password = authPassword.value;
    if (!email || !password) {
      showAuthError('请输入邮箱和密码');
      return;
    }
    if (password.length < 6) {
      showAuthError('密码至少6位');
      return;
    }
    signupBtn.disabled = true;
    const { error } = await supabase.auth.signUp({ email, password });
    signupBtn.disabled = false;
    if (error) {
      showAuthError(error.message);
    } else {
      showCustomAlert('注册成功！请查收验证邮件。', 'success');
    }
  });

  // 退出登录
  logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
  });

  // ==================== 每日例句 ====================

  const dailySentencesSection = document.getElementById('dailySentencesSection');
  const dailySentencesList = document.getElementById('dailySentencesList');

  async function loadDailySentences() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      dailySentencesSection.style.display = 'none';
      return;
    }

    // UTC+8 今天的日期
    const now = new Date();
    const nowUtc8 = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const todayStr = nowUtc8.toISOString().slice(0, 10);

    const { data: sentences, error } = await supabase
      .from('daily_sentences')
      .select('word, sentence, translation')
      .eq('user_id', session.user.id)
      .eq('created_date', todayStr)
      .limit(1);

    if (error || !sentences || sentences.length === 0) {
      dailySentencesSection.style.display = 'none';
      return;
    }

    const entry = sentences[0];
    const words = entry.word.split(',').map(w => w.trim().toLowerCase());

    // Highlight target words in the paragraph
    let highlightedText = entry.sentence;
    for (const w of words) {
      const regex = new RegExp(`\\b(${w}[a-z]*)\\b`, 'gi');
      highlightedText = highlightedText.replace(regex, '<b class="sentence-highlight">$1</b>');
    }

    dailySentencesSection.style.display = 'block';
    dailySentencesList.innerHTML = `
      <div class="sentence-card">
        <div class="sentence-words">${words.join(' · ')}</div>
        <div class="sentence-en">${highlightedText}</div>
        <div class="sentence-zh">${entry.translation}</div>
      </div>
    `;
  }

  // 启动认证检查
  initAuth();

  // ==================== 核心功能 ====================

  // 检查初始化状态
  function checkInitialized() {
    chrome.storage.local.get(['initialized', 'knownWords'], (result) => {
      if (result.initialized && result.knownWords && result.knownWords.length > 0) {
        showMainView();
      } else {
        showSetupView();
      }
    });
  }

  // 显示冷启动界面
  function showSetupView() {
    setupView.style.display = 'block';
    mainView.style.display = 'none';
    
    // 添加入场动画
    setupView.style.opacity = '0';
    setupView.style.transform = 'translateY(10px)';
    requestAnimationFrame(() => {
      setupView.style.transition = 'all 0.3s ease';
      setupView.style.opacity = '1';
      setupView.style.transform = 'translateY(0)';
    });
  }

  // 显示主界面
  function showMainView() {
    setupView.style.display = 'none';
    mainView.style.display = 'block';
    
    // 添加入场动画
    mainView.style.opacity = '0';
    mainView.style.transform = 'translateY(10px)';
    requestAnimationFrame(() => {
      mainView.style.transition = 'all 0.3s ease';
      mainView.style.opacity = '1';
      mainView.style.transform = 'translateY(0)';
    });

    loadState();
    loadDailySentences();
  }

  // === 冷启动界面事件 ===

  // 考试分级选项数据
  const EXAM_OPTIONS = {
    cet4: [
      { label: '没过 (<425)', value: 'cet4-fail' },
      { label: '过线 (425分)', value: 'cet4-425' },
      { label: '500分', value: 'cet4-500' },
      { label: '550+', value: 'cet4-550' }
    ],
    cet6: [
      { label: '没过 (<425)', value: 'cet6-fail' },
      { label: '过线 (425分)', value: 'cet6-425' },
      { label: '500分', value: 'cet6-500' },
      { label: '550+', value: 'cet6-550' }
    ],
    ielts: [
      { label: '5.5', value: 'ielts-5.5' },
      { label: '6.0', value: 'ielts-6.0' },
      { label: '6.5', value: 'ielts-6.5' },
      { label: '7.0+', value: 'ielts-7.0' }
    ],
    toefl: [
      { label: '60分', value: 'toefl-60' },
      { label: '80分', value: 'toefl-80' },
      { label: '100+', value: 'toefl-100' }
    ]
  };

  let selectedExamValue = null;

  // 考试 Tab 切换
  const examTabs = document.querySelectorAll('.exam-tab');
  const examOptionsEl = document.getElementById('examOptions');

  examTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // 切换 tab 激活态
      examTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      const exam = tab.dataset.exam;
      const options = EXAM_OPTIONS[exam];

      examOptionsEl.innerHTML = options.map(opt => `
        <label class="exam-option ${opt.value === selectedExamValue ? 'selected' : ''}">
          <input type="radio" name="examLevel" value="${opt.value}" ${opt.value === selectedExamValue ? 'checked' : ''}>
          <span class="exam-option-label">${opt.label}</span>
        </label>
      `).join('');

      // 绑定选项点击
      examOptionsEl.querySelectorAll('input[name="examLevel"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
          selectedExamValue = e.target.value;
          examOptionsEl.querySelectorAll('.exam-option').forEach(el => el.classList.remove('selected'));
          e.target.closest('.exam-option').classList.add('selected');
          examConfirmBtn.style.display = 'block';
        });
      });
    });
  });

  // 确认选择
  examConfirmBtn.addEventListener('click', () => {
    if (!selectedExamValue) return;
    importVocabLevel(selectedExamValue);
  });

  // 冷启动界面的文件导入
  setupImportBtn.addEventListener('click', () => {
    setupFileInput.click();
  });

  setupFileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await importFromFile(file, true);
    setupFileInput.value = '';
  });

  // === 主界面事件 ===

  // 启用/禁用开关
  enableToggle.addEventListener('change', () => {
    chrome.storage.local.set({ enabled: enableToggle.checked });
  });

  // 追加导入
  importBtn.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    await importFromFile(file, false);
    fileInput.value = '';
  });

  // 更换级别
  changeLevelBtn.addEventListener('click', () => {
    showLevelModal();
  });

  // 导出新认识的词
  exportBtn.addEventListener('click', () => {
    chrome.storage.local.get(['knownWords', 'importedWords'], (result) => {
      const knownWords = result.knownWords || [];
      const importedWords = new Set(result.importedWords || []);
      const learnedWords = knownWords.filter(w => !importedWords.has(w));

      if (learnedWords.length === 0) {
        showCustomAlert('还没有新认识的单词', 'info');
        return;
      }

      const content = learnedWords.join('\n');
      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = url;
      a.download = `新认识的单词_${new Date().toISOString().slice(0, 10)}.txt`;
      a.click();

      URL.revokeObjectURL(url);
      
      // 成功反馈
      exportBtn.classList.add('success-flash');
      setTimeout(() => exportBtn.classList.remove('success-flash'), 500);
    });
  });

  // 刷新当前页面
  refreshBtn.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.reload(tabs[0].id);
      }
    });
  });

  // 清空新认识的词
  clearLearnedBtn.addEventListener('click', () => {
    showCustomConfirm('确定要清空所有新认识的单词吗？', () => {
      chrome.storage.local.get(['importedWords'], (result) => {
        const importedWords = result.importedWords || [];
        chrome.storage.local.set({ knownWords: [...importedWords] }, () => {
          loadState();
        });
      });
    });
  });

  // 重置所有数据
  resetAllBtn.addEventListener('click', () => {
    showCustomConfirm('确定要重置所有数据吗？这将清空所有词汇和设置。', () => {
      showCustomConfirm('再次确认：所有数据将被删除，无法恢复！', () => {
        chrome.storage.local.clear(() => {
          showSetupView();
        });
      });
    });
  });

  // ==================== 自定义弹窗 ====================
  
  function showCustomAlert(message, type = 'info') {
    const modal = document.createElement('div');
    modal.className = 'level-modal';
    modal.innerHTML = `
      <div class="level-modal-content" style="text-align: center; padding: 28px;">
        <div style="font-size: 40px; margin-bottom: 12px;">
          ${type === 'success' ? '🎉' : type === 'error' ? '😅' : '💡'}
        </div>
        <p style="font-size: 15px; color: #1F2937; margin-bottom: 20px;">${message}</p>
        <button class="btn btn-primary" style="margin-top: 0;">好的</button>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('.btn').addEventListener('click', () => {
      modal.style.opacity = '0';
      setTimeout(() => modal.remove(), 200);
    });
  }
  
  function showCustomConfirm(message, onConfirm) {
    const modal = document.createElement('div');
    modal.className = 'level-modal';
    modal.innerHTML = `
      <div class="level-modal-content" style="text-align: center; padding: 28px;">
        <div style="font-size: 40px; margin-bottom: 12px;">🤔</div>
        <p style="font-size: 15px; color: #1F2937; margin-bottom: 20px;">${message}</p>
        <div style="display: flex; gap: 10px;">
          <button class="btn btn-secondary cancel-btn" style="flex: 1; margin-top: 0;">取消</button>
          <button class="btn btn-primary confirm-btn" style="flex: 1; margin-top: 0;">确定</button>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('.cancel-btn').addEventListener('click', () => {
      modal.style.opacity = '0';
      setTimeout(() => modal.remove(), 200);
    });
    
    modal.querySelector('.confirm-btn').addEventListener('click', () => {
      modal.style.opacity = '0';
      setTimeout(() => modal.remove(), 200);
      onConfirm();
    });
  }

  // === 工具函数 ===

  // 导入词汇表（从服务器拉取）
  async function importVocabLevel(levelKey) {
    showCustomAlert('正在加载词汇表...', 'info');

    const words = await fetchVocabulary(levelKey);
    if (!words || words.length === 0) {
      showCustomAlert('词汇表加载失败，请检查网络', 'error');
      return;
    }

    const lowerWords = words.map(w => w.toLowerCase());

    chrome.storage.local.set({
      initialized: true,
      enabled: true,
      currentLevel: levelKey,
      importedWords: lowerWords,
      knownWords: lowerWords
    }, () => {
      showMainView();
    });
  }

  // 从文件导入
  async function importFromFile(file, isInitial) {
    const text = await file.text();
    const lines = text.split('\n');
    const words = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      // 提取英文单词部分
      const englishMatch = trimmed.match(/^[a-zA-Z][a-zA-Z\s'-]*/);
      if (englishMatch) {
        const word = englishMatch[0].trim().toLowerCase();
        if (word.length >= 2) {
          words.push(word);
        }
      }
    }

    if (words.length === 0) {
      showCustomAlert('未找到有效的英文单词', 'error');
      return;
    }

    chrome.storage.local.get(['knownWords', 'importedWords'], (result) => {
      let newImported, newKnown;

      if (isInitial) {
        // 初始导入
        newImported = [...new Set(words)];
        newKnown = [...new Set(words)];
      } else {
        // 追加导入
        const existingImported = result.importedWords || [];
        const existingKnown = result.knownWords || [];
        newImported = [...new Set([...existingImported, ...words])];
        newKnown = [...new Set([...existingKnown, ...words])];
      }

      chrome.storage.local.set({
        initialized: true,
        enabled: true,
        currentLevel: isInitial ? 'custom' : undefined,
        importedWords: newImported,
        knownWords: newKnown
      }, () => {
        if (isInitial) {
          showMainView();
        } else {
          loadState();
        }
        showCustomAlert(`成功导入 ${words.length} 个词汇！`, 'success');
      });
    });
  }

  // 考试分数值 → 显示标签
  const EXAM_LABELS = {
    'cet4-fail': '四级 <425',
    'cet4-425': '四级 425分',
    'cet4-500': '四级 500分',
    'cet4-550': '四级 550+',
    'cet6-fail': '六级 <425',
    'cet6-425': '六级 425分',
    'cet6-500': '六级 500分',
    'cet6-550': '六级 550+',
    'ielts-5.5': '雅思 5.5',
    'ielts-6.0': '雅思 6.0',
    'ielts-6.5': '雅思 6.5',
    'ielts-7.0': '雅思 7.0+',
    'toefl-60': '托福 60',
    'toefl-80': '托福 80',
    'toefl-100': '托福 100+'
  };

  // 加载状态
  function loadState() {
    chrome.storage.local.get(['enabled', 'knownWords', 'importedWords', 'currentLevel'], (result) => {
      enableToggle.checked = result.enabled !== false;

      const knownWords = result.knownWords || [];
      const importedWords = new Set(result.importedWords || []);

      // 使用数字滚动动画更新统计
      animateNumber(totalWordsEl, knownWords.length);

      const learnedWords = knownWords.filter(w => !importedWords.has(w));
      animateNumber(learnedWordsEl, learnedWords.length);

      // 显示当前级别
      const level = result.currentLevel;
      if (level && EXAM_LABELS[level]) {
        currentLevelEl.textContent = `${EXAM_LABELS[level]} (${importedWords.size.toLocaleString()} 词)`;
      } else if (level === 'custom') {
        currentLevelEl.textContent = `自定义词汇表 (${importedWords.size.toLocaleString()} 词)`;
      } else if (level) {
        currentLevelEl.textContent = `${level} (${importedWords.size.toLocaleString()} 词)`;
      } else {
        currentLevelEl.textContent = '';
      }

      updateLearnedList(learnedWords);
    });
  }

  // 更新新词列表
  function updateLearnedList(words) {
    if (words.length === 0) {
      learnedList.innerHTML = '<p class="empty-hint">点击网页上带下划线的单词即可添加</p>';
      return;
    }

    // 只显示最近的20个
    const recentWords = words.slice(-20).reverse();
    learnedList.innerHTML = recentWords.map((word, index) => `
      <span class="word-item" style="animation-delay: ${index * 0.03}s">
        ${word}
        <button class="remove-btn" data-word="${word}" title="移除">×</button>
      </span>
    `).join('');

    if (words.length > 20) {
      learnedList.innerHTML += `<p class="empty-hint">还有 ${words.length - 20} 个...</p>`;
    }

    learnedList.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const word = e.target.dataset.word;
        const wordItem = e.target.parentElement;
        
        // 添加移除动画
        wordItem.style.transform = 'scale(0.8)';
        wordItem.style.opacity = '0';
        
        setTimeout(() => {
          removeLearnedWord(word);
        }, 200);
      });
    });
  }

  // 移除新词
  function removeLearnedWord(word) {
    chrome.storage.local.get(['knownWords'], (result) => {
      const knownWords = result.knownWords || [];
      const newKnownWords = knownWords.filter(w => w !== word);
      chrome.storage.local.set({ knownWords: newKnownWords }, () => {
        loadState();
      });
    });
  }

  // 显示级别选择弹窗
  function showLevelModal() {
    let modalSelectedValue = null;

    const modal = document.createElement('div');
    modal.className = 'level-modal';
    modal.innerHTML = `
      <div class="level-modal-content">
        <h3>选择新的级别</h3>
        <div class="exam-selector">
          <div class="exam-tabs">
            <button class="exam-tab" data-exam="cet4">四级</button>
            <button class="exam-tab" data-exam="cet6">六级</button>
            <button class="exam-tab" data-exam="ielts">雅思</button>
            <button class="exam-tab" data-exam="toefl">托福</button>
          </div>
          <div class="exam-options" id="modalExamOptions"></div>
        </div>
        <div style="display: flex; gap: 10px; margin-top: 12px;">
          <button class="btn btn-secondary modal-close" style="flex: 1;">取消</button>
          <button class="btn btn-primary modal-confirm" style="flex: 1; display: none;">确认</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const modalTabs = modal.querySelectorAll('.exam-tab');
    const modalOptions = modal.querySelector('#modalExamOptions');
    const modalConfirm = modal.querySelector('.modal-confirm');

    modalTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        modalTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        const exam = tab.dataset.exam;
        const options = EXAM_OPTIONS[exam];

        modalOptions.innerHTML = options.map(opt => `
          <label class="exam-option ${opt.value === modalSelectedValue ? 'selected' : ''}">
            <input type="radio" name="modalExamLevel" value="${opt.value}" ${opt.value === modalSelectedValue ? 'checked' : ''}>
            <span class="exam-option-label">${opt.label}</span>
          </label>
        `).join('');

        modalOptions.querySelectorAll('input[name="modalExamLevel"]').forEach(radio => {
          radio.addEventListener('change', (e) => {
            modalSelectedValue = e.target.value;
            modalOptions.querySelectorAll('.exam-option').forEach(el => el.classList.remove('selected'));
            e.target.closest('.exam-option').classList.add('selected');
            modalConfirm.style.display = 'block';
          });
        });
      });
    });

    modalConfirm.addEventListener('click', () => {
      if (!modalSelectedValue) return;
      changeLevel(modalSelectedValue);
      modal.remove();
    });

    // 关闭
    modal.querySelector('.modal-close').addEventListener('click', () => {
      modal.style.opacity = '0';
      setTimeout(() => modal.remove(), 200);
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.opacity = '0';
        setTimeout(() => modal.remove(), 200);
      }
    });
  }

  // 更换级别
  async function changeLevel(levelKey) {
    const words = await fetchVocabulary(levelKey);
    if (!words || words.length === 0) {
      showCustomAlert('词汇表加载失败，请检查网络', 'error');
      return;
    }

    const lowerWords = words.map(w => w.toLowerCase());

    // 保留新认识的词
    chrome.storage.local.get(['knownWords', 'importedWords'], (result) => {
      const oldKnown = result.knownWords || [];
      const oldImported = new Set(result.importedWords || []);

      // 新认识的词 = 原来认识的 - 原来导入的
      const learnedWords = oldKnown.filter(w => !oldImported.has(w));

      // 新的认识词汇 = 新级别词汇 + 保留的新认识词
      const newKnown = [...new Set([...lowerWords, ...learnedWords])];

      const label = EXAM_LABELS[levelKey] || levelKey;
      chrome.storage.local.set({
        currentLevel: levelKey,
        importedWords: lowerWords,
        knownWords: newKnown
      }, () => {
        loadState();
        showCustomAlert(`已更换到 ${label}！`, 'success');
      });
    });
  }
});

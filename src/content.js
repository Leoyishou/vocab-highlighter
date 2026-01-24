// Vocab Highlighter - Content Script
// 标记网页上不认识的单词 - 温暖极简 UI + 微交互动画
import './content.css';

(function() {
  'use strict';

  let knownWords = new Set();
  let isEnabled = true;
  const WORD_REGEX = /\b[a-zA-Z]{2,}\b/g;

  // 不处理的标签
  const SKIP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED',
    'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'CODE', 'PRE', 'SVG'
  ]);

  // 从storage加载词汇表
  async function loadVocabulary() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['knownWords', 'enabled'], (result) => {
        if (result.knownWords) {
          knownWords = new Set(result.knownWords.map(w => w.toLowerCase()));
        }
        if (result.enabled !== undefined) {
          isEnabled = result.enabled;
        }
        resolve();
      });
    });
  }

  // 检查单词是否已认识
  function isKnown(word) {
    return knownWords.has(word.toLowerCase());
  }

  // 处理文本节点
  function processTextNode(textNode) {
    const text = textNode.textContent;
    const words = text.match(WORD_REGEX);

    if (!words || words.length === 0) return;

    // 检查是否有生词
    const hasUnknown = words.some(word => !isKnown(word));
    if (!hasUnknown) return;

    const fragment = document.createDocumentFragment();
    let lastIndex = 0;
    let match;
    const regex = new RegExp(WORD_REGEX);

    while ((match = regex.exec(text)) !== null) {
      const word = match[0];
      const startIndex = match.index;

      // 添加匹配前的文本
      if (startIndex > lastIndex) {
        fragment.appendChild(document.createTextNode(text.slice(lastIndex, startIndex)));
      }

      if (!isKnown(word)) {
        // 生词 - 用span包裹并添加下划线
        const span = document.createElement('span');
        span.className = 'vocab-unknown-word';
        span.textContent = word;
        span.dataset.word = word.toLowerCase();
        span.title = '点击标记为已认识';
        fragment.appendChild(span);
      } else {
        // 已认识的词 - 直接添加文本
        fragment.appendChild(document.createTextNode(word));
      }

      lastIndex = startIndex + word.length;
    }

    // 添加剩余文本
    if (lastIndex < text.length) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
    }

    // 替换原节点
    textNode.parentNode.replaceChild(fragment, textNode);
  }

  // 遍历DOM树处理文本节点
  function walkTree(node) {
    if (!node) return;

    if (SKIP_TAGS.has(node.nodeName)) return;

    // 跳过已处理的元素
    if (node.classList && node.classList.contains('vocab-unknown-word')) return;
    if (node.classList && node.classList.contains('vocab-processed')) return;

    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.trim();
      if (text.length > 0 && WORD_REGEX.test(text)) {
        processTextNode(node);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      // 复制子节点列表，因为处理过程中可能会修改
      const children = Array.from(node.childNodes);
      children.forEach(child => walkTree(child));
    }
  }

  // 处理整个页面
  function processPage() {
    if (!isEnabled || knownWords.size === 0) return;

    const body = document.body;
    if (!body) return;

    // 标记正在处理
    if (body.classList.contains('vocab-processing')) return;
    body.classList.add('vocab-processing');

    walkTree(body);

    body.classList.remove('vocab-processing');
    body.classList.add('vocab-processed');
  }

  // 创建成功粒子效果
  function createSuccessParticles(element) {
    const rect = element.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // 创建 5 个小粒子
    for (let i = 0; i < 5; i++) {
      const particle = document.createElement('div');
      particle.style.cssText = `
        position: fixed;
        width: 6px;
        height: 6px;
        background: linear-gradient(135deg, #F59E0B, #10B981);
        border-radius: 50%;
        pointer-events: none;
        z-index: 2147483647;
        left: ${centerX}px;
        top: ${centerY}px;
      `;
      
      document.body.appendChild(particle);
      
      // 随机方向
      const angle = (Math.PI * 2 * i) / 5 + Math.random() * 0.5;
      const distance = 30 + Math.random() * 20;
      const targetX = Math.cos(angle) * distance;
      const targetY = Math.sin(angle) * distance;
      
      // 动画
      particle.animate([
        { 
          transform: 'translate(0, 0) scale(1)', 
          opacity: 1 
        },
        { 
          transform: `translate(${targetX}px, ${targetY}px) scale(0)`, 
          opacity: 0 
        }
      ], {
        duration: 500,
        easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
      }).onfinish = () => particle.remove();
    }
  }

  // 提取单词所在的句子
  function extractSentence(element, word) {
    // 获取父级块元素的文本内容
    let container = element.parentElement;
    while (container && getComputedStyle(container).display === 'inline') {
      container = container.parentElement;
    }
    if (!container) container = element.parentElement;

    const text = container.innerText || container.textContent || '';
    // 按句号/问号/感叹号分割
    const sentences = text.split(/(?<=[.!?])\s+/);
    const wordLower = word.toLowerCase();

    for (const sentence of sentences) {
      if (sentence.toLowerCase().includes(wordLower)) {
        const trimmed = sentence.trim();
        // 截断过长句子
        return trimmed.length > 300 ? trimmed.slice(0, 300) + '...' : trimmed;
      }
    }
    return null;
  }

  // 点击事件 - 标记为已认识（带微交互）
  function handleClick(event) {
    const target = event.target;
    if (!target.classList || !target.classList.contains('vocab-unknown-word')) return;

    const word = target.dataset.word;
    if (!word) return;

    // 提取上下文句子
    const context = extractSentence(target, word);

    // 添加到已认识列表
    knownWords.add(word);

    // 通知 background 处理存储和同步
    chrome.runtime.sendMessage({ action: 'addWord', word, context });

    // 创建粒子效果
    createSuccessParticles(target);

    // 移除下划线样式，添加成功样式
    target.classList.remove('vocab-unknown-word');
    target.classList.add('vocab-known-word');
    target.title = '';

    // 同时移除页面上所有相同单词的标记
    document.querySelectorAll(`.vocab-unknown-word[data-word="${word}"]`).forEach((el, index) => {
      // 错开动画时间
      setTimeout(() => {
        el.classList.remove('vocab-unknown-word');
        el.classList.add('vocab-known-word');
        el.title = '';
      }, index * 50);
    });

    // 显示提示
    showToast(`已添加: ${word}`);
  }

  // 显示提示（带弹跳动画）
  function showToast(message) {
    let toast = document.getElementById('vocab-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'vocab-toast';
      document.body.appendChild(toast);
    }
    
    // 更新消息（不包含图标，图标由 CSS ::before 处理）
    toast.textContent = message;
    
    // 移除之前的动画类
    toast.classList.remove('vocab-toast-show');
    
    // 强制重绘
    void toast.offsetWidth;
    
    // 添加显示类
    toast.classList.add('vocab-toast-show');

    // 清除之前的定时器
    if (toast.hideTimeout) {
      clearTimeout(toast.hideTimeout);
    }
    
    toast.hideTimeout = setTimeout(() => {
      toast.classList.remove('vocab-toast-show');
    }, 1800);
  }

  // 监听storage变化
  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local') {
      if (changes.knownWords) {
        knownWords = new Set((changes.knownWords.newValue || []).map(w => w.toLowerCase()));
        // 重新处理页面
        document.querySelectorAll('.vocab-unknown-word').forEach(el => {
          if (isKnown(el.dataset.word)) {
            el.classList.remove('vocab-unknown-word');
            el.classList.add('vocab-known-word');
            el.title = '';
          }
        });
      }
      if (changes.enabled !== undefined) {
        isEnabled = changes.enabled.newValue;
        if (!isEnabled) {
          // 禁用时移除所有标记
          document.querySelectorAll('.vocab-unknown-word').forEach(el => {
            el.classList.remove('vocab-unknown-word');
          });
        }
      }
    }
  });

  // 监听DOM变化，处理动态加载的内容
  const observer = new MutationObserver((mutations) => {
    if (!isEnabled || knownWords.size === 0) return;

    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
          walkTree(node);
        }
      });
    });
  });

  // 初始化
  async function init() {
    await loadVocabulary();

    // 添加点击监听
    document.addEventListener('click', handleClick);

    // 处理页面
    processPage();

    // 开始观察DOM变化
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  // 等待DOM加载完成
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

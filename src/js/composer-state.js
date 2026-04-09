// src/js/composer-state.js
(() => {
  const EMPTY_PROMPT_HTML = '<p data-placeholder="Ask anything" class="placeholder"><br class="ProseMirror-trailingBreak"></p>';
  const SEND_BUTTON_HTML = '<div><button id="composer-submit-button" type="button" aria-label="Send prompt" data-testid="send-button" class="composer-submit-btn composer-submit-button-color h-9 w-9"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" aria-hidden="true" class="icon"><use href="#01bab7" fill="currentColor"></use></svg></button></div>';
  const STOP_BUTTON_HTML = '<div><button id="composer-submit-button" type="button" aria-label="Stop streaming" data-testid="stop-button" class="composer-submit-btn composer-secondary-button-color h-9 w-9"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" aria-hidden="true" class="icon"><use href="#bbf3a9" fill="currentColor"></use></svg></button></div>';

  const normalizeText = (value) => String(value || '')
    .replace(/\u200B/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const hasPromptText = (editor) => normalizeText(editor?.textContent) !== '';

  const isLargePrompt = (editor) => {
    if (!(editor instanceof HTMLElement)) {
      return false;
    }

    const computed = window.getComputedStyle(editor);
    const lineHeight = Number.parseFloat(computed.lineHeight) || 24;
    const paragraphNodes = Array.from(editor.querySelectorAll('p'));
    const meaningfulParagraphs = paragraphNodes.filter((node) => normalizeText(node.textContent) !== '');

    if (meaningfulParagraphs.length > 1) {
      return true;
    }

    return editor.scrollHeight > lineHeight * 1.8;
  };

  const placeCaretAtStart = (editor) => {
    if (!(editor instanceof HTMLElement) || document.activeElement !== editor) {
      return;
    }

    const selection = window.getSelection?.();
    if (!selection) {
      return;
    }

    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  };

  const setFilledPromptMarkup = (editor) => {
    editor.querySelectorAll('p.placeholder[data-placeholder]').forEach((node) => {
      node.classList.remove('placeholder');
      node.removeAttribute('data-placeholder');
    });
  };

  const setEmptyPromptMarkup = (editor) => {
    const currentHtml = editor.innerHTML.replace(/\s+/g, ' ').trim();
    const emptyHtml = EMPTY_PROMPT_HTML.replace(/\s+/g, ' ').trim();

    if (currentHtml !== emptyHtml) {
      editor.innerHTML = EMPTY_PROMPT_HTML;
      placeCaretAtStart(editor);
    }
  };

  const bindComposerState = () => {
    const editor = document.querySelector('#prompt-textarea.ProseMirror[contenteditable="true"]');
    const composerForm = document.querySelector('form.group\\/composer[data-type="unified-composer"]');
    const composerSurface = document.querySelector('[data-composer-surface="true"]');
    const trailingArea = composerSurface?.querySelector('div[class*="[grid-area:trailing]"] .ms-auto');

    if (!(editor instanceof HTMLElement) || !(trailingArea instanceof HTMLElement) || !(composerForm instanceof HTMLFormElement) || !(composerSurface instanceof HTMLElement)) {
      return;
    }

    if (editor.dataset.composerStateBound === 'true') {
      return;
    }

    editor.dataset.composerStateBound = 'true';
    const defaultTrailingMarkup = trailingArea.innerHTML;
    const defaultComposerSurfaceClassName = composerSurface.className;
    let rafId = null;
    let keepExpandedWhileFilled = false;

    const getThreadMode = () => composerForm.dataset.threadMode === 'conversation' ? 'conversation' : 'initial';
    const getChatUiMode = () => composerForm.dataset.chatUiMode === 'streaming' ? 'streaming' : 'idle';

    const setTrailingState = (state) => {
      let nextMarkup = defaultTrailingMarkup;
      if (state === 'filled') {
        nextMarkup = SEND_BUTTON_HTML;
      } else if (state === 'streaming') {
        nextMarkup = STOP_BUTTON_HTML;
      }

      if (trailingArea.innerHTML.trim() !== nextMarkup.trim()) {
        trailingArea.innerHTML = nextMarkup;
      }

      trailingArea.dataset.trailingState = state;
      document.dispatchEvent(new CustomEvent('stage:close-click-popovers', {
        detail: { source: 'composer-state', owner: 'composer-trailing' }
      }));
    };

    const setComposerExpandedState = (expanded, conversationMode = false) => {
      if (expanded) {
        composerForm.setAttribute('data-expanded', '');
      } else {
        composerForm.removeAttribute('data-expanded');
      }

      if (conversationMode || expanded) {
        composerSurface.className = defaultComposerSurfaceClassName
          .replace('dark:bg-[#303030]', 'dark:bg-token-bg-elevated-primary');
      } else {
        composerSurface.className = defaultComposerSurfaceClassName;
      }
    };

    const renderState = () => {
      const filled = hasPromptText(editor);
      const threadMode = getThreadMode();
      const chatUiMode = getChatUiMode();
      const conversationMode = threadMode === 'conversation';

      if (!filled) {
        keepExpandedWhileFilled = false;
      } else if (isLargePrompt(editor)) {
        keepExpandedWhileFilled = true;
      }

      const expanded = filled && keepExpandedWhileFilled;

      if (chatUiMode === 'streaming') {
        if (filled) {
          setFilledPromptMarkup(editor);
        } else {
          setEmptyPromptMarkup(editor);
        }
        setComposerExpandedState(expanded, true);
        if (trailingArea.dataset.trailingState !== 'streaming') {
          setTrailingState('streaming');
        }
        return;
      }

      if (filled) {
        setFilledPromptMarkup(editor);
        setComposerExpandedState(expanded, conversationMode);
        if (trailingArea.dataset.trailingState !== 'filled') {
          setTrailingState('filled');
        }
        return;
      }

      setEmptyPromptMarkup(editor);
      setComposerExpandedState(false, conversationMode);
      const emptyState = 'default';
      if (trailingArea.dataset.trailingState !== emptyState) {
        setTrailingState(emptyState);
      }
    };

    const scheduleRender = () => {
      if (rafId) {
        return;
      }

      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        renderState();
      });
    };

    const syncExternalComposerMode = (event) => {
      const detail = event.detail || {};
      if (typeof detail.threadMode === 'string') {
        composerForm.dataset.threadMode = detail.threadMode;
      }
      if (typeof detail.chatUiMode === 'string') {
        composerForm.dataset.chatUiMode = detail.chatUiMode;
      }
      scheduleRender();
    };

    editor.addEventListener('input', scheduleRender);
    editor.addEventListener('keyup', scheduleRender);
    editor.addEventListener('paste', scheduleRender);
    editor.addEventListener('blur', scheduleRender);
    editor.addEventListener('focus', scheduleRender);

    const observer = new MutationObserver(scheduleRender);
    observer.observe(editor, {
      childList: true,
      characterData: true,
      subtree: true
    });

    document.addEventListener('stage:composer-mode', syncExternalComposerMode);

    renderState();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindComposerState, { once: true });
  } else {
    bindComposerState();
  }
})();

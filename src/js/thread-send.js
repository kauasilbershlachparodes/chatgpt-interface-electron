// src/js/thread-send.js
(() => {
  const EMPTY_PROMPT_HTML = '<p data-placeholder="Ask anything" class="placeholder"><br class="ProseMirror-trailingBreak"></p>';
  const ASSISTANT_REPLY = 'Oi! Em que posso te ajudar?';
  const STREAM_DELAY_MS = 900;
  const CONVERSATION_LAYOUT_CLASS = 'relative basis-auto flex-col grow flex';
  const THREAD_BOTTOM_CLASS = 'sticky bottom-0 z-10 group/thread-bottom-container relative isolate w-full basis-auto has-data-has-thread-error:pt-2 has-data-has-thread-error:[box-shadow:var(--sharp-edge-bottom-shadow)] md:border-transparent md:pt-0 dark:border-white/20 md:dark:border-transparent print:hidden content-fade single-line flex flex-col mt-auto';
  const DISCLAIMER_STORAGE_KEY = 'stage-thread-disclaimer-dismissed';
  const DISCLAIMER_COOKIE_KEY = 'stage_thread_disclaimer_dismissed';

  let activeStream = null;

  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));

  const normalizeText = (value) => String(value || '')
    .replace(/\u200B/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const createId = (prefix) => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return `${prefix}-${crypto.randomUUID()}`;
    }

    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  };

  const readCookie = (name) => {
    const cookies = document.cookie ? document.cookie.split('; ') : [];
    const prefix = `${name}=`;
    const match = cookies.find((entry) => entry.startsWith(prefix));
    return match ? decodeURIComponent(match.slice(prefix.length)) : '';
  };

  const writeCookie = (name, value, maxAgeSeconds) => {
    document.cookie = `${name}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax`;
  };

  const isDisclaimerDismissed = () => {
    try {
      if (window.localStorage?.getItem(DISCLAIMER_STORAGE_KEY) === 'true') {
        return true;
      }
    } catch {}

    return readCookie(DISCLAIMER_COOKIE_KEY) === 'true';
  };

  const persistDisclaimerDismissed = () => {
    try {
      window.localStorage?.setItem(DISCLAIMER_STORAGE_KEY, 'true');
    } catch {}

    writeCookie(DISCLAIMER_COOKIE_KEY, 'true', 60 * 60 * 24 * 365);
  };

  const dispatchComposerMode = (detail) => {
    document.dispatchEvent(new CustomEvent('stage:composer-mode', { detail }));
  };

  const copyTextToClipboard = async (value) => {
    const text = String(value || '');
    if (!text) {
      return false;
    }

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}

    const fallbackTextarea = document.createElement('textarea');
    fallbackTextarea.value = text;
    fallbackTextarea.setAttribute('readonly', 'true');
    fallbackTextarea.style.position = 'fixed';
    fallbackTextarea.style.opacity = '0';
    fallbackTextarea.style.pointerEvents = 'none';
    document.body.appendChild(fallbackTextarea);
    fallbackTextarea.focus();
    fallbackTextarea.select();

    let copied = false;
    try {
      copied = document.execCommand('copy');
    } catch {
      copied = false;
    }

    fallbackTextarea.remove();
    return copied;
  };

  const getEditor = () => document.querySelector('#prompt-textarea.ProseMirror[contenteditable="true"]');
  const getComposerForm = () => document.querySelector('form.group\\/composer[data-type="unified-composer"]');
  const getThreadBottomContainer = () => document.getElementById('thread-bottom-container');
  const getComposerParentLayoutRoot = () => document.querySelector('#thread .composer-parent > div');

  const createEdge = (edge) => {
    const node = document.createElement('div');
    node.setAttribute('aria-hidden', 'true');
    node.setAttribute('data-edge', 'true');
    node.setAttribute('data-thread-edge', edge);
    node.className = `pointer-events-none h-px w-px absolute ${edge === 'top' ? 'top-0' : 'bottom-0'}`;
    return node;
  };

  const ensureConversationTurnsHost = () => {
    const layoutRoot = getComposerParentLayoutRoot();
    const threadBottomContainer = getThreadBottomContainer();

    if (!(layoutRoot instanceof HTMLElement) || !(threadBottomContainer instanceof HTMLElement)) {
      return null;
    }

    let turnsHost = layoutRoot.querySelector('[data-thread-turns]');
    if (turnsHost instanceof HTMLElement) {
      return turnsHost;
    }

    const preservedThreadBottom = threadBottomContainer;
    if (preservedThreadBottom.parentElement === layoutRoot) {
      layoutRoot.removeChild(preservedThreadBottom);
    }

    while (layoutRoot.firstChild) {
      layoutRoot.removeChild(layoutRoot.firstChild);
    }

    layoutRoot.className = CONVERSATION_LAYOUT_CLASS;

    const topEdge = createEdge('top');
    const bottomEdge = createEdge('bottom');
    turnsHost = document.createElement('div');
    turnsHost.setAttribute('data-thread-turns', 'true');
    turnsHost.className = 'flex flex-col text-sm pb-25';

    preservedThreadBottom.className = THREAD_BOTTOM_CLASS;
    preservedThreadBottom.style.marginTop = 'auto';

    const scrollOffsetNode = document.createElement('div');
    scrollOffsetNode.setAttribute('data-thread-scroll-offset', 'true');
    scrollOffsetNode.className = 'relative mx-auto h-0';
    scrollOffsetNode.style.setProperty('--thread-scroll-to-bottom-banner-offset', '0px');

    const threadBottom = preservedThreadBottom.querySelector('#thread-bottom');
    if (threadBottom instanceof HTMLElement && threadBottom.previousElementSibling !== scrollOffsetNode) {
      preservedThreadBottom.insertBefore(scrollOffsetNode, threadBottom);
    }

    if (threadBottom instanceof HTMLElement) {
      const primaryThreadBottomContent = threadBottom.firstElementChild;
      Array.from(threadBottom.children).forEach((child) => {
        if (!(child instanceof HTMLElement)) {
          return;
        }

        if (child !== primaryThreadBottomContent) {
          child.remove();
        }
      });
    }

    Array.from(preservedThreadBottom.children).forEach((child) => {
      if (!(child instanceof HTMLElement)) {
        return;
      }

      if (child !== scrollOffsetNode && child !== threadBottom) {
        child.remove();
      }
    });

    const composerShell = preservedThreadBottom.querySelector('.pointer-events-auto.relative.z-1.flex');
    const composerForm = getComposerForm();
    if (composerShell instanceof HTMLElement && composerForm instanceof HTMLElement) {
      let bannerHost = composerShell.querySelector('[data-thread-disclaimer-host]');
      if (!(bannerHost instanceof HTMLElement)) {
        bannerHost = document.createElement('div');
        bannerHost.setAttribute('data-thread-disclaimer-host', 'true');
        bannerHost.className = 'absolute start-0 end-0 bottom-full z-20';
        composerShell.insertBefore(bannerHost, composerForm);
      }
    }

    layoutRoot.append(topEdge, turnsHost, bottomEdge, preservedThreadBottom);
    return turnsHost;
  };

  const updateConversationSpacing = (hasBanner) => {
    const turnsHost = document.querySelector('[data-thread-turns]');
    const scrollOffsetNode = document.querySelector('[data-thread-scroll-offset]');

    if (turnsHost instanceof HTMLElement) {
      turnsHost.style.paddingBottom = '';
    }

    if (scrollOffsetNode instanceof HTMLElement) {
      scrollOffsetNode.style.setProperty('--thread-scroll-to-bottom-banner-offset', hasBanner ? '102px' : '0px');
    }
  };

  const scrollThreadToBottom = () => {
    const scrollRoot = document.querySelector('[data-scroll-root]');
    if (scrollRoot instanceof HTMLElement) {
      scrollRoot.scrollTop = scrollRoot.scrollHeight;
    }
  };

  const getTurnCopyText = (trigger) => {
    const turnSection = trigger.closest('section[data-turn]');
    if (!(turnSection instanceof HTMLElement)) {
      return '';
    }

    const userBubble = turnSection.querySelector('[data-message-author-role="user"] .whitespace-pre-wrap');
    if (userBubble instanceof HTMLElement) {
      return normalizeText(userBubble.textContent);
    }

    const assistantMessage = turnSection.querySelector('[data-message-author-role="assistant"] .markdown');
    if (assistantMessage instanceof HTMLElement) {
      return normalizeText(assistantMessage.textContent);
    }

    return '';
  };

  const createUserTurn = (message) => {
    const turnId = createId('user-turn');
    const section = document.createElement('section');
    section.className = 'text-token-text-primary w-full focus:outline-none [--shadow-height:45px] has-data-writing-block:pointer-events-none has-data-writing-block:-mt-(--shadow-height) has-data-writing-block:pt-(--shadow-height) [&:has([data-writing-block])>*]:pointer-events-auto scroll-mt-(--header-height)';
    section.setAttribute('dir', 'auto');
    section.setAttribute('data-turn-id', turnId);
    section.setAttribute('data-testid', 'conversation-turn-user');
    section.setAttribute('data-scroll-anchor', 'false');
    section.setAttribute('data-turn', 'user');
    section.innerHTML = `
      <h4 class="sr-only select-none">You said:</h4>
      <div class="text-base my-auto mx-auto pt-3 [--thread-content-margin:var(--thread-content-margin-xs,calc(var(--spacing)*4))] @w-sm/main:[--thread-content-margin:var(--thread-content-margin-sm,calc(var(--spacing)*6))] @w-lg/main:[--thread-content-margin:var(--thread-content-margin-lg,calc(var(--spacing)*16))] px-(--thread-content-margin)">
        <div class="[--thread-content-max-width:40rem] @w-lg/main:[--thread-content-max-width:48rem] mx-auto max-w-(--thread-content-max-width) flex-1 group/turn-messages focus-visible:outline-hidden relative flex w-full min-w-0 flex-col">
          <div class="flex max-w-full flex-col gap-4 grow">
            <div data-message-author-role="user" data-message-id="${escapeHtml(turnId)}" dir="auto" class="min-h-8 text-message relative flex w-full flex-col items-end gap-2 text-start break-words whitespace-normal outline-none keyboard-focused:focus-ring [.text-message+&]:mt-1">
              <div class="flex w-full flex-col gap-1 empty:hidden items-end rtl:items-start">
                <div class="user-message-bubble-color corner-superellipse/0.98 relative rounded-[22px] px-4 py-2.5 leading-6 max-w-(--user-chat-width,70%)">
                  <div class="whitespace-pre-wrap">${escapeHtml(message)}</div>
                </div>
              </div>
            </div>
          </div>
          <div class="z-0 flex justify-end">
            <div aria-label="Your message actions" class="touch:-me-2 touch:-ms-3.5 -ms-2.5 -me-1 flex flex-wrap items-center gap-y-4 p-1 select-none focus-within:transition-none hover:transition-none touch:pointer-events-auto touch:opacity-100 duration-300 group-hover/turn-messages:delay-300 pointer-events-none opacity-0 motion-safe:transition-opacity group-hover/turn-messages:pointer-events-auto group-hover/turn-messages:opacity-100 group-focus-within/turn-messages:pointer-events-auto group-focus-within/turn-messages:opacity-100 has-data-[state=open]:pointer-events-auto has-data-[state=open]:opacity-100" role="group" tabindex="-1" style="mask-position: 0% 0%;">
              <button class="text-token-text-secondary hover:bg-token-bg-secondary rounded-lg" aria-label="Copy message" data-testid="copy-turn-action-button" data-state="closed">
                <span class="flex items-center justify-center touch:w-10 h-8 w-8">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" aria-hidden="true" class="icon"><use href="#ce3544" fill="currentColor"></use></svg>
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <span class="sr-only"><br></span>
    `;
    return section;
  };

  const createAssistantStreamingTurn = () => {
    const turnId = createId('assistant-turn');
    const section = document.createElement('section');
    section.className = 'text-token-text-primary w-full focus:outline-none [--shadow-height:45px] has-data-writing-block:pointer-events-none has-data-writing-block:-mt-(--shadow-height) has-data-writing-block:pt-(--shadow-height) [&:has([data-writing-block])>*]:pointer-events-auto scroll-mt-[calc(var(--header-height)+min(200px,max(70px,20svh)))]';
    section.setAttribute('dir', 'auto');
    section.setAttribute('data-turn-id', turnId);
    section.setAttribute('data-testid', 'conversation-turn-assistant');
    section.setAttribute('data-scroll-anchor', 'true');
    section.setAttribute('data-turn', 'assistant');
    section.innerHTML = `
      <h4 class="sr-only select-none">ChatGPT said:</h4>
      <div class="text-base my-auto mx-auto pb-10 [--thread-content-margin:var(--thread-content-margin-xs,calc(var(--spacing)*4))] @w-sm/main:[--thread-content-margin:var(--thread-content-margin-sm,calc(var(--spacing)*6))] @w-lg/main:[--thread-content-margin:var(--thread-content-margin-lg,calc(var(--spacing)*16))] px-(--thread-content-margin)">
        <div class="[--thread-content-max-width:40rem] @w-lg/main:[--thread-content-max-width:48rem] mx-auto max-w-(--thread-content-max-width) flex-1 group/turn-messages focus-visible:outline-hidden relative flex w-full min-w-0 flex-col agent-turn">
          <div class="flex max-w-full flex-col gap-4 grow">
            <div data-message-author-role="assistant" data-message-id="request-placeholder-${escapeHtml(turnId)}" dir="auto" class="min-h-8 text-message relative flex w-full flex-col items-end gap-2 text-start break-words whitespace-normal outline-none keyboard-focused:focus-ring [.text-message+&]:mt-1">
              <div class="flex w-full flex-col gap-1 empty:hidden">
                <div aria-busy="true" class="result-streaming pulse"><span><pre></pre></span></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    return { section, turnId };
  };

  const renderAssistantComplete = (assistantSection, replyText) => {
    const turnId = assistantSection.getAttribute('data-turn-id') || createId('assistant-turn');
    assistantSection.innerHTML = `
      <h4 class="sr-only select-none">ChatGPT said:</h4>
      <div class="text-base my-auto mx-auto pb-10 [--thread-content-margin:var(--thread-content-margin-xs,calc(var(--spacing)*4))] @w-sm/main:[--thread-content-margin:var(--thread-content-margin-sm,calc(var(--spacing)*6))] @w-lg/main:[--thread-content-margin:var(--thread-content-margin-lg,calc(var(--spacing)*16))] px-(--thread-content-margin)">
        <div class="[--thread-content-max-width:40rem] @w-lg/main:[--thread-content-max-width:48rem] mx-auto max-w-(--thread-content-max-width) flex-1 group/turn-messages focus-visible:outline-hidden relative flex w-full min-w-0 flex-col agent-turn">
          <div class="flex max-w-full flex-col gap-4 grow">
            <div data-message-author-role="assistant" data-message-id="${escapeHtml(turnId)}" dir="auto" data-message-model-slug="gpt-5-3" class="min-h-8 text-message relative flex w-full flex-col items-end gap-2 text-start break-words whitespace-normal outline-none keyboard-focused:focus-ring [.text-message+&]:mt-1" data-turn-start-message="true" tabindex="0">
              <div class="flex w-full flex-col gap-1 empty:hidden">
                <div class="markdown prose dark:prose-invert w-full wrap-break-word dark markdown-new-styling">
                  <p data-start="0" data-end="${String(replyText.length)}" data-is-last-node="" data-is-only-node="">${escapeHtml(replyText)}</p>
                </div>
              </div>
            </div>
          </div>
          <div class="z-0 flex min-h-[46px] justify-start">
            <div aria-label="Response actions" class="touch:-me-2 touch:-ms-3.5 -ms-2.5 -me-1 flex flex-wrap items-center gap-y-4 p-1 select-none touch:w-[calc(100%+--spacing(3.5))] -mt-1 w-[calc(100%+--spacing(2.5))] duration-[1.5s] focus-within:transition-none hover:transition-none touch:pointer-events-auto pointer-events-none [mask-image:linear-gradient(to_right,black_33%,transparent_66%)] [mask-size:300%_100%] [mask-position:100%_0%] motion-safe:transition-[mask-position] group-hover/turn-messages:pointer-events-auto group-hover/turn-messages:[mask-position:0_0] group-focus-within/turn-messages:pointer-events-auto group-focus-within/turn-messages:[mask-position:0_0] has-data-[state=open]:pointer-events-auto has-data-[state=open]:[mask-position:0_0]" role="group" tabindex="-1" style="mask-position: 0% 0%;">
              <button class="text-token-text-secondary hover:bg-token-bg-secondary rounded-lg" aria-label="Copy response" data-testid="copy-turn-action-button" data-state="closed">
                <span class="flex items-center justify-center touch:w-10 h-8 w-8">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" aria-hidden="true" class="icon"><use href="#ce3544" fill="currentColor"></use></svg>
                </span>
              </button>
              <button class="text-token-text-secondary hover:bg-token-bg-secondary rounded-lg" aria-label="Share" data-state="closed">
                <span class="flex items-center justify-center touch:w-10 h-8 w-8">
                  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" aria-hidden="true" class="icon"><use href="#630ca2" fill="currentColor"></use></svg>
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  };

  const ensureDisclaimer = () => {
    const bannerHost = document.querySelector('[data-thread-disclaimer-host]');
    if (!(bannerHost instanceof HTMLElement)) {
      return;
    }

    if (isDisclaimerDismissed()) {
      updateConversationSpacing(false);
      return;
    }

    if (bannerHost.querySelector('[data-thread-disclaimer]')) {
      updateConversationSpacing(true);
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-thread-disclaimer', 'true');
    wrapper.className = 'relative h-full w-full';
    wrapper.innerHTML = `
      <div class="mb-2 flex flex-col gap-3.5 pt-2">
        <aside class="flex w-full items-start gap-4 rounded-3xl border py-4 ps-5 pe-3 text-sm [text-wrap:pretty] lg:mx-auto dark:border-transparent shadow-xxs md:items-center border-token-border-default bg-token-main-surface-primary text-token-text-primary dark:bg-token-main-surface-secondary">
          <div class="flex h-full w-full gap-3 md:items-center">
            <div class="flex grow flex-col md:flex-row md:items-center md:justify-between md:gap-8">
              <div class="flex flex-col">
                <div class="">
                  <span class="pointer-events-auto text-token-text-secondary text-sm leading-none">By messaging ChatGPT, an AI chatbot, you agree to our <a href="https://openai.com/terms" target="_blank" class="text-token-text-secondary decoration-token-text-secondary underline" rel="noreferrer">Terms</a> and have read our <a href="https://openai.com/privacy" target="_blank" class="text-token-text-secondary decoration-token-text-secondary underline" rel="noreferrer">Privacy Policy</a>. See <a class="text-token-text-secondary decoration-token-text-secondary underline cursor-pointer">Cookie Preferences</a>.</span><br>Don't share sensitive info. Chats may be reviewed and used to train our models. <a href="https://help.openai.com/en/articles/5722486-how-your-data-is-used-to-improve-model-performance" target="_blank" class="text-token-text-primary underline">Learn more</a>
                </div>
              </div>
            </div>
            <div class="flex shrink-0 items-start gap-2 sm:items-center">
              <button data-testid="close-button" class="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-token-surface-hover dark:hover:bg-token-main-surface-tertiary keyboard-focused:bg-token-surface-hover bg-transparent" aria-label="Close">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" aria-hidden="true" class="icon"><use href="#85f94b" fill="currentColor"></use></svg>
              </button>
            </div>
          </div>
        </aside>
      </div>
    `;

    bannerHost.appendChild(wrapper);
    updateConversationSpacing(true);

    wrapper.querySelector('[data-testid="close-button"]')?.addEventListener('click', () => {
      persistDisclaimerDismissed();
      wrapper.remove();
      updateConversationSpacing(false);
    });
  };

  const clearEditor = (editor) => {
    if (!(editor instanceof HTMLElement)) {
      return;
    }

    editor.innerHTML = EMPTY_PROMPT_HTML;
    editor.dispatchEvent(new Event('input', { bubbles: true }));
  };

  const finishStreaming = (replyText = ASSISTANT_REPLY) => {
    if (!activeStream) {
      return;
    }

    window.clearTimeout(activeStream.timerId);
    renderAssistantComplete(activeStream.assistantSection, replyText);
    ensureDisclaimer();
    dispatchComposerMode({ threadMode: 'conversation', chatUiMode: 'idle' });
    activeStream = null;
    scrollThreadToBottom();
  };

  const sendPrompt = () => {
    const editor = getEditor();
    if (!(editor instanceof HTMLElement) || activeStream) {
      return;
    }

    const promptText = normalizeText(editor.textContent);
    if (!promptText) {
      return;
    }

    const turnsHost = ensureConversationTurnsHost();
    if (!(turnsHost instanceof HTMLElement)) {
      return;
    }

    updateConversationSpacing(false);
    turnsHost.appendChild(createUserTurn(promptText));
    const assistantStream = createAssistantStreamingTurn();
    turnsHost.appendChild(assistantStream.section);

    clearEditor(editor);
    dispatchComposerMode({ threadMode: 'conversation', chatUiMode: 'streaming' });
    scrollThreadToBottom();

    activeStream = {
      assistantSection: assistantStream.section,
      timerId: window.setTimeout(() => finishStreaming(), STREAM_DELAY_MS)
    };
  };

  const bindThreadSend = () => {
    const editor = getEditor();
    if (!(editor instanceof HTMLElement) || editor.dataset.threadSendBound === 'true') {
      return;
    }

    editor.dataset.threadSendBound = 'true';

    document.addEventListener('click', async (event) => {
      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const sendButton = target.closest('[data-testid="send-button"]');
      if (sendButton instanceof HTMLElement) {
        event.preventDefault();
        sendPrompt();
        return;
      }

      const stopButton = target.closest('[data-testid="stop-button"]');
      if (stopButton instanceof HTMLElement) {
        event.preventDefault();
        finishStreaming();
        return;
      }

      const copyButton = target.closest('[data-testid="copy-turn-action-button"]');
      if (copyButton instanceof HTMLElement) {
        event.preventDefault();
        await copyTextToClipboard(getTurnCopyText(copyButton));
      }
    });

    editor.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        if (activeStream) {
          return;
        }
        sendPrompt();
      }
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindThreadSend, { once: true });
  } else {
    bindThreadSend();
  }
})();

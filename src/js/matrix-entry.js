(() => {
  const HERO_PROMPTS = [
    {
      title: 'Suggest fun activities',
      body: 'for a family of 4 to do indoors on a rainy day',
    },
    {
      title: 'Brainstorm names',
      body: "for an orange cat we're adopting from the shelter",
    },
    {
      title: 'Recommend a dish',
      body: "to impress a date who's a picky eater",
    },
    {
      title: 'Plan a trip',
      body: 'to experience Seoul like a local',
    },
    {
      title: 'Write a thank-you note',
      body: 'to our babysitter for the last-minute help',
    },
    {
      title: 'Summarize this article',
      body: 'as a table of pros and cons',
    },
    {
      title: 'Help me pick',
      body: 'a gift for my dad who loves fishing',
    },
    {
      title: 'Help me debug',
      body: "why the linked list appears empty after I've reversed it",
    },
    {
      title: 'Draft an email',
      body: 'to request a quote from local plumbers',
    },
    {
      title: 'Suggest fun activities',
      body: 'for a team-building day with remote employees',
    },
    {
      title: 'Recommend a dish',
      body: 'to bring to a potluck',
    },
    {
      title: 'Improve my post',
      body: 'for selling a used vacuum in good condition',
    },
    {
      title: 'Improve my post',
      body: 'for hiring a store associate',
    },
    {
      title: 'Write a text',
      body: 'that goes with a kitten gif for a friend having a rough day',
    },
  ];

  const sleep = (ms) =>
    new Promise((resolve) => {
      window.setTimeout(resolve, ms);
    });

  const nextFrame = () =>
    new Promise((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });

  const initHeroPromptRotator = () => {
    const rotator = document.querySelector('#hero-prompt-rotator');
    const firstPanelElement = rotator?.querySelector('[data-hero-prompt-panel]');

    if (!rotator || !firstPanelElement) return;

    const prefersReducedMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

    const panelTransitionMs = 600;
    const blankHoldMs = 20;
    const bodyCharMs = 42;
    const pauseAfterTypingMs = 1400;
    const pauseBeforeTypingMs = 100;

    const createPanelRefs = (panelElement) => ({
      element: panelElement,
      title: panelElement.querySelector('[data-hero-prompt-title]'),
      body: panelElement.querySelector('[data-hero-prompt-body]'),
      dot: panelElement.querySelector('[data-hero-prompt-dot]'),
    });

    const secondPanelElement = firstPanelElement.cloneNode(true);
    secondPanelElement.classList.remove('is-active');
    rotator.appendChild(secondPanelElement);

    const sizerPanelElement = firstPanelElement.cloneNode(true);
    sizerPanelElement.classList.remove('is-active', 'is-exiting');
    sizerPanelElement.classList.add('hero-prompt-panel--sizer');
    sizerPanelElement.setAttribute('aria-hidden', 'true');
    rotator.appendChild(sizerPanelElement);

    const panels = [
      createPanelRefs(firstPanelElement),
      createPanelRefs(secondPanelElement),
    ];
    const sizerPanel = createPanelRefs(sizerPanelElement);

    if ([...panels, sizerPanel].some((panel) => !panel.title || !panel.body || !panel.dot)) {
      return;
    }

    let activePanel = panels[0];
    let standbyPanel = panels[1];
    let index = 0;

    const setDotVisible = (panel, visible) => {
      panel.dot.innerHTML = '&ZeroWidthSpace;&#9679;';
      panel.dot.classList.toggle('is-hidden', !visible);
    };

    const setPromptLabel = (prompt, typedBody = '') => {
      rotator.setAttribute(
        'aria-label',
        [prompt.title, typedBody || prompt.body].filter(Boolean).join(' '),
      );
    };

    const renderPanel = (panel, prompt, { typedBody = '', showDot = false } = {}) => {
      panel.title.textContent = prompt.title;
      panel.body.textContent = typedBody;
      setDotVisible(panel, showDot);
      setPromptLabel(prompt, typedBody);
    };

    const updateSizer = () => {
      let tallestPrompt = HERO_PROMPTS[0];
      let tallestHeight = 0;

      HERO_PROMPTS.forEach((prompt) => {
        renderPanel(sizerPanel, prompt, { typedBody: prompt.body, showDot: false });
        const panelHeight = sizerPanel.element.offsetHeight;

        if (panelHeight >= tallestHeight) {
          tallestHeight = panelHeight;
          tallestPrompt = prompt;
        }
      });

      renderPanel(sizerPanel, tallestPrompt, {
        typedBody: tallestPrompt.body,
        showDot: false,
      });
    };

    const typePromptBody = async (panel, prompt) => {
      renderPanel(panel, prompt, { typedBody: '', showDot: true });

      for (let i = 1; i <= prompt.body.length; i += 1) {
        const typedBody = prompt.body.slice(0, i);
        panel.body.textContent = typedBody;
        setPromptLabel(prompt, typedBody);
        await sleep(bodyCharMs);
      }

      await sleep(900);
      setDotVisible(panel, false);
      setPromptLabel(prompt);
      await sleep(pauseAfterTypingMs);
    };

    const transitionToPrompt = async (nextPrompt) => {
      renderPanel(standbyPanel, nextPrompt, { typedBody: '', showDot: true });
      standbyPanel.element.classList.remove('is-active', 'is-exiting');

      await nextFrame();
      await nextFrame();

      activePanel.element.classList.add('is-exiting');
      activePanel.element.classList.remove('is-active');

      await sleep(panelTransitionMs);
      await sleep(blankHoldMs);

      standbyPanel.element.classList.add('is-active');
      await sleep(panelTransitionMs);

      activePanel.element.classList.remove('is-exiting');
      [activePanel, standbyPanel] = [standbyPanel, activePanel];
      await sleep(pauseBeforeTypingMs);
    };

    const runReducedMotionLoop = async () => {
      updateSizer();
      activePanel.element.classList.add('is-active');

      while (true) {
        const prompt = HERO_PROMPTS[index];
        renderPanel(activePanel, prompt, { typedBody: prompt.body, showDot: false });
        standbyPanel.element.classList.remove('is-active', 'is-exiting');
        await sleep(2800);
        index = (index + 1) % HERO_PROMPTS.length;
      }
    };

    const runAnimatedLoop = async () => {
      updateSizer();
      const firstPrompt = HERO_PROMPTS[index];
      renderPanel(activePanel, firstPrompt, { typedBody: '', showDot: true });
      standbyPanel.element.classList.remove('is-active', 'is-exiting');

      await nextFrame();
      await nextFrame();

      activePanel.element.classList.add('is-active');
      await sleep(panelTransitionMs);
      await sleep(pauseBeforeTypingMs);

      while (true) {
        const prompt = HERO_PROMPTS[index];
        await typePromptBody(activePanel, prompt);

        const nextIndex = (index + 1) % HERO_PROMPTS.length;
        const nextPrompt = HERO_PROMPTS[nextIndex];
        await transitionToPrompt(nextPrompt);
        index = nextIndex;
      }
    };

    let resizeTimeout = null;
    const handleResize = () => {
      if (resizeTimeout) {
        window.clearTimeout(resizeTimeout);
      }

      resizeTimeout = window.setTimeout(() => {
        updateSizer();
      }, 120);
    };

    window.addEventListener('resize', handleResize);

    if (prefersReducedMotion) {
      runReducedMotionLoop();
      return;
    }

    runAnimatedLoop();
  };

  const init = () => {
    initHeroPromptRotator();

    const matrix = window.MatrixSession;
    if (!matrix) return;

    const loginButton = document.querySelector('[data-testid="login-button"]');
    const signupButton = document.querySelector('[data-testid="signup-button"]');
    const tryFirstButton = Array.from(document.querySelectorAll('button')).find(
      (button) => /try it first/i.test(button.textContent || ''),
    );

    if (loginButton) {
      loginButton.type = 'button';
      loginButton.addEventListener('click', () => {
        matrix.clearPendingAuth();
        matrix.setPendingAuth({ mode: 'login', email: '' });
        window.location.href = 'log-in-or-create-account.html?mode=login';
      });
    }

    if (signupButton) {
      signupButton.type = 'button';
      signupButton.addEventListener('click', () => {
        matrix.clearPendingAuth();
        matrix.setPendingAuth({ mode: 'signup', email: '' });
        window.location.href = 'log-in-or-create-account.html?mode=signup';
      });
    }

    if (tryFirstButton) {
      tryFirstButton.type = 'button';
      tryFirstButton.addEventListener('click', () => {
        matrix.clearPendingAuth();
        matrix.startGuestSession();
        window.location.href = 'index.html';
      });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();

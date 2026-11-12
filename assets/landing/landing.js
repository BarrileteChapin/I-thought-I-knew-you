(function () {
  var video = document.getElementById('l-intro-video');
  var btn = document.getElementById('l-intro-mute');
  if (video && btn) {
    btn.addEventListener('click', function () {
      if (video.muted) {
        video.muted = false;
        btn.setAttribute('data-unmuted', 'true');
        btn.setAttribute('aria-label', 'Mute');
      } else {
        video.muted = true;
        btn.setAttribute('data-unmuted', 'false');
        btn.setAttribute('aria-label', 'Unmute');
      }
    });
  }

  var personPath =
    'M8 2a2.5 2.5 0 1 0 0 5a2.5 2.5 0 0 0 0-5M4 8.5A1.5 1.5 0 0 1 5.5 7h5A1.5 1.5 0 0 1 12 8.5c0 1.33-.472 2.436-1.266 3.195C9.949 12.447 9.023 12.87 8 12.87s-1.949-.424-2.734-1.175C4.472 10.936 4 9.831 4 8.5';

  Array.prototype.forEach.call(document.querySelectorAll('.l-people[data-total]'), function (el) {
    var filled = parseInt(el.getAttribute('data-filled') || '0', 10);
    var total = parseInt(el.getAttribute('data-total') || '0', 10);
    var html = '';
    for (var i = 0; i < total; i += 1) {
      html +=
        '<svg' +
        (i < filled ? ' class="is-on"' : '') +
        ' width="36" height="36" viewBox="0 0 16 16" aria-hidden="true">' +
        '<path fill="currentColor" d="' +
        personPath +
        '"></path></svg>';
    }
    el.innerHTML = html;
  });

  var contactForm = document.getElementById('l-contact-form');
  var contactHeld = document.getElementById('l-contact-held');
  if (contactForm && contactHeld) {
    contactForm.addEventListener('submit', function (event) {
      event.preventDefault();
      contactHeld.hidden = false;
    });
  }

  var reduceMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var header = document.querySelector('.l-header');
  var hero = document.getElementById('top');

  function updateHeaderLogo() {
    if (!header || !hero || !hero.classList.contains('l-hero')) return;
    var past = hero.getBoundingClientRect().bottom <= 48;
    header.classList.toggle('is-past-hero', past);
  }

  if (reduceMotion || typeof gsap === 'undefined') {
    window.addEventListener('scroll', updateHeaderLogo, { passive: true });
    window.addEventListener('resize', updateHeaderLogo);
    updateHeaderLogo();
    return;
  }

  var hasSplitText = typeof SplitText !== 'undefined';
  if (typeof ScrollTrigger !== 'undefined') gsap.registerPlugin(ScrollTrigger);
  if (hasSplitText) gsap.registerPlugin(SplitText);

  // —— Lenis ——
  var lenis = null;
  if (typeof Lenis === 'function') {
    lenis = new Lenis({
      duration: 1.1,
      smoothWheel: true,
      touchMultiplier: 1.1,
    });
    lenis.on('scroll', updateHeaderLogo);
    if (typeof ScrollTrigger !== 'undefined') {
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(function (time) {
        lenis.raf(time * 1000);
      });
      gsap.ticker.lagSmoothing(0);
    }
  } else {
    window.addEventListener('scroll', updateHeaderLogo, { passive: true });
  }
  window.addEventListener('resize', updateHeaderLogo);
  updateHeaderLogo();

  function makeSplit(el, vars) {
    if (!hasSplitText || !el) return null;
    if (typeof SplitText.create === 'function') {
      return SplitText.create(el, vars);
    }
    return new SplitText(el, vars);
  }

  // —— Section headings (.l-h2 / .l-h3): keep entrance motion ——
  // Story heading is excluded — stays quiet inside the nights scrub.
  if (hasSplitText && typeof ScrollTrigger !== 'undefined') {
    Array.prototype.forEach.call(document.querySelectorAll('.l-h2, .l-h3'), function (el) {
      if (el.classList.contains('l-night-story-heading')) return;

      var split = makeSplit(el, {
        type: 'lines',
        linesClass: 'l-split-line',
        mask: 'lines',
      });

      if (split && split.lines && split.lines.length) {
        gsap.from(split.lines, {
          yPercent: 110,
          duration: 0.95,
          ease: 'power4.out',
          stagger: 0.08,
          scrollTrigger: {
            trigger: el,
            start: 'top 85%',
            once: true,
          },
        });
      }
    });
  }

  // —— Section grow: 92% → 100% as it settles into place (Boldly-style) ——
  // When scale locks, run fact pictogram / bar reveal once.
  function playFactReveal(section) {
    var facts = section.querySelectorAll('.l-fact');
    Array.prototype.forEach.call(facts, function (fact, factIndex) {
      if (fact.classList.contains('is-animated')) return;
      fact.classList.add('is-animated');

      var icons = fact.querySelectorAll('.l-people svg');
      var bar = fact.querySelector('.l-fact-bar > span');
      var delay = factIndex * 0.08;

      if (icons.length) {
        gsap.to(icons, {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.45,
          stagger: 0.06,
          delay: delay,
          ease: 'power3.out',
          clearProps: 'transform',
        });
      }

      if (bar) {
        var target = bar.style.getPropertyValue('--l-bar') || '20%';
        gsap.fromTo(
          bar,
          { width: '0%' },
          {
            width: target,
            duration: 0.7,
            delay: delay + 0.12,
            ease: 'power2.out',
          }
        );
      }
    });
  }

  if (typeof ScrollTrigger !== 'undefined') {
    Array.prototype.forEach.call(document.querySelectorAll('.l-section--grow'), function (el) {
      var fromScale = parseFloat(el.getAttribute('data-grow') || '0.92');
      if (!(fromScale > 0 && fromScale < 1)) fromScale = 0.92;

      gsap.fromTo(
        el,
        { scale: fromScale },
        {
          scale: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: el,
            start: 'top 92%',
            end: 'top 18%',
            scrub: 0.55,
            invalidateOnRefresh: true,
            onLeave: function () {
              playPanelSettle(el);
            },
            onEnterBack: function () {
              /* keep settle reveals; no reverse */
            },
          },
        }
      );

      // If already past settle point on load, reveal immediately
      ScrollTrigger.create({
        trigger: el,
        start: 'top 18%',
        once: true,
        onEnter: function () {
          playPanelSettle(el);
        },
      });
    });
  }

  // —— SIFT connectors: faint → solid, drawn left → right when panel settles ——
  function playSiftDraw(root) {
    var sift = root && root.querySelector ? root.querySelector('.l-sift') || root : null;
    if (!sift || !sift.classList || !sift.classList.contains('l-sift')) return;
    if (sift.classList.contains('is-drawn')) return;
    sift.classList.add('is-drawn');
    var links = sift.querySelectorAll('.l-sift-link');
    if (!links.length) return;

    gsap.fromTo(
      links,
      { scaleX: 0, opacity: 0.12 },
      {
        scaleX: 1,
        opacity: 1,
        duration: 0.55,
        stagger: 0.18,
        ease: 'power2.inOut',
        transformOrigin: 'left center',
      }
    );
  }

  function playPanelSettle(el) {
    playFactReveal(el);
    playSiftDraw(el);
  }

  // —— Nights scrub + quiet body reveal (story heading: no anim) ——
  var nightsSection = document.getElementById('project');
  var nightsTrack = document.getElementById('l-nights-track');
  var storyCard = document.getElementById('l-night-story');
  if (!nightsSection || !nightsTrack || !storyCard) return;
  if (typeof ScrollTrigger === 'undefined') return;

  var nightsPin = nightsSection.querySelector('.l-nights-pin');
  var nightCards = nightsTrack.querySelectorAll('.l-night-card:not(.l-night-card--story)');
  var storyHeading = storyCard.querySelector('.l-night-story-heading');
  var storyLineEls = Array.prototype.slice.call(
    storyCard.querySelectorAll('[data-story-line]')
  );

  // Body: timed reveal after expand settles (not scrub-linked)
  gsap.set(storyLineEls, { opacity: 0, y: 16 });
  var storyBodyPlayed = false;

  function playStoryBody() {
    if (!storyLineEls.length || storyBodyPlayed) return;
    storyBodyPlayed = true;
    gsap.to(storyLineEls, {
      opacity: 1,
      y: 0,
      duration: 0.55,
      stagger: 0.12,
      ease: 'power3.out',
    });
  }

  function resetStoryBody() {
    storyBodyPlayed = false;
    gsap.killTweensOf(storyLineEls);
    gsap.set(storyLineEls, { opacity: 0, y: 16 });
  }

  var storyBaseW = 0;
  var storyBaseH = 0;

  function headingRestScale() {
    if (!storyHeading) return 1;
    var large = parseFloat(window.getComputedStyle(storyHeading).fontSize) || 44;
    // Visual size on the compact card ≈ 26px
    return Math.min(0.62, 26 / large);
  }

  function measureBase() {
    gsap.set(storyCard, { clearProps: 'width,flexBasis,minHeight,borderRadius,height' });
    gsap.set(nightsTrack, { clearProps: 'x' });
    if (storyHeading) gsap.set(storyHeading, { clearProps: 'scale' });
    storyCard.classList.remove('is-wide', 'is-fullbleed');
    nightsSection.classList.remove('is-story-full');
    void storyCard.offsetWidth;
    storyBaseW = storyCard.getBoundingClientRect().width;
    storyBaseH = storyCard.getBoundingClientRect().height;
    if (storyHeading) {
      gsap.set(storyHeading, {
        scale: headingRestScale(),
        transformOrigin: '50% 50%',
      });
    }
  }

  function storyCenterX(width) {
    var w = width == null ? storyCard.offsetWidth : width;
    return -(storyCard.offsetLeft + w / 2 - window.innerWidth / 2);
  }

  measureBase();

  var tl = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      trigger: nightsSection,
      start: 'top top',
      end: '+=380%',
      pin: nightsPin || true,
      scrub: 0.55,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  });

  // 1) Horizontal scrub to center story
  tl.to(
    nightsTrack,
    {
      duration: 1,
      x: function () {
        return storyCenterX(storyBaseW);
      },
    },
    0
  );

  // 2) Heading grows first and settles; background expand finishes after
  if (storyHeading) {
    tl.fromTo(
      storyHeading,
      {
        scale: function () {
          return headingRestScale();
        },
        transformOrigin: '50% 50%',
      },
      {
        duration: 0.36,
        scale: 1,
        transformOrigin: '50% 50%',
        ease: 'power2.out',
      },
      0.96
    );
  }

  tl.to(
    storyCard,
    {
      duration: 0.48,
      width: function () {
        return window.innerWidth;
      },
      flexBasis: function () {
        return window.innerWidth;
      },
      minHeight: function () {
        return window.innerHeight;
      },
      borderRadius: 0,
      onUpdate: function () {
        var p = this.progress();
        storyCard.classList.toggle('is-wide', p > 0.2);
        storyCard.classList.toggle('is-fullbleed', p > 0.85);
        nightsSection.classList.toggle('is-story-full', p > 0.92);
        if (p >= 0.92) playStoryBody();
        else if (p < 0.5 && storyBodyPlayed) resetStoryBody();
      },
      onComplete: function () {
        storyCard.classList.add('is-wide', 'is-fullbleed');
        nightsSection.classList.add('is-story-full');
        playStoryBody();
      },
      onReverseComplete: function () {
        storyCard.classList.remove('is-wide', 'is-fullbleed');
        nightsSection.classList.remove('is-story-full');
        resetStoryBody();
        if (storyHeading) {
          gsap.set(storyHeading, {
            scale: headingRestScale(),
            transformOrigin: '50% 50%',
          });
        }
      },
    },
    1
  );

  tl.to(
    nightsTrack,
    {
      duration: 0.48,
      x: function () {
        return storyCenterX(window.innerWidth);
      },
    },
    1
  );

  tl.to(nightCards, { duration: 0.3, opacity: 0 }, 1);

  if (nightsPin) {
    tl.to(nightsPin, { duration: 0.3, backgroundColor: '#0d1020' }, 1);
  }

  // Hold after settle so timed body anim can play while still pinned
  tl.to({}, { duration: 0.55 });

  function refreshMotion() {
    measureBase();
    ScrollTrigger.refresh();
  }

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(refreshMotion, 180);
  });

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      refreshMotion();
    });
  }
})();

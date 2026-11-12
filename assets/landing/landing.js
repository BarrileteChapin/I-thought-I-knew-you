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

  // Hero logo: slit-scan displacement (same idea as karinkiho.com/en/experiment/slit)
  (function initHeroLogoSlit() {
    var wrap = document.querySelector('.l-hero-logo-glitch');
    var img = wrap && wrap.querySelector('.l-hero-logo');
    var canvas = wrap && wrap.querySelector('.l-hero-logo-canvas');
    if (!wrap || !img || !canvas) return;

    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduceMotion && reduceMotion.matches) return;

    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    var CUT_GAP = 5;
    var FLUCTUATION = 9;
    var NOISE_SCALE = 0.08;
    var sourceCanvas = document.createElement('canvas');
    var sourceCtx = sourceCanvas.getContext('2d', { willReadFrequently: true });
    var sourceData = null;
    var offsets = [];
    var raf = 0;
    var lastFrame = 0;
    var seed = 42;

    function hashSeed(value) {
      var h = 2166136261;
      var text = String(value);
      for (var i = 0; i < text.length; i += 1) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return h >>> 0;
    }

    // Compact value-noise (enough for band offsets; not full Perlin)
    function noise1(x) {
      var s = hashSeed(seed + ':' + Math.floor(x * 1000));
      var t = (s % 10000) / 10000;
      return t;
    }

    function softNoise(x) {
      var i = Math.floor(x);
      var f = x - i;
      var u = f * f * (3 - 2 * f);
      return noise1(i) * (1 - u) + noise1(i + 1) * u;
    }

    function rebuildOffsets(bandCount, amount, time) {
      offsets.length = bandCount;
      for (var i = 0; i < bandCount; i += 1) {
        var n = softNoise(i * NOISE_SCALE + time * 0.12);
        offsets[i] = (n - 0.5) * 2 * amount;
      }
    }

    function paintSource(w, h) {
      sourceCanvas.width = w;
      sourceCanvas.height = h;
      sourceCtx.clearRect(0, 0, w, h);
      sourceCtx.drawImage(img, 0, 0, w, h);
      sourceData = sourceCtx.getImageData(0, 0, w, h);
    }

    function drawSlit(time) {
      var rect = wrap.getBoundingClientRect();
      var w = Math.max(1, Math.round(rect.width));
      var h = Math.max(1, Math.round(rect.height));
      if (canvas.width !== w || canvas.height !== h || !sourceData) {
        canvas.width = w;
        canvas.height = h;
        paintSource(w, h);
      }
      if (!sourceData) return;

      var amount = FLUCTUATION * (0.55 + 0.45 * Math.sin(time * 0.7));
      // Horizontal slits: bands by Y, slide along X (slit angle ≈ 90°)
      var bandCount = Math.ceil(h / CUT_GAP) + 1;
      rebuildOffsets(bandCount, amount, time);

      var out = ctx.createImageData(w, h);
      var src = sourceData.data;
      var dst = out.data;
      var pitch = CUT_GAP;

      for (var y = 0; y < h; y += 1) {
        var band = Math.floor(y / pitch);
        var offset = offsets[band] || 0;
        for (var x = 0; x < w; x += 1) {
          var sx = Math.round(x - offset);
          var di = (y * w + x) << 2;
          if (sx < 0 || sx >= w) {
            dst[di] = 0;
            dst[di + 1] = 0;
            dst[di + 2] = 0;
            dst[di + 3] = 0;
            continue;
          }
          var si = (y * w + sx) << 2;
          dst[di] = src[si];
          dst[di + 1] = src[si + 1];
          dst[di + 2] = src[si + 2];
          dst[di + 3] = src[si + 3];
        }
      }
      ctx.putImageData(out, 0, 0);
    }

    function tick(now) {
      if (now - lastFrame < 48) {
        raf = requestAnimationFrame(tick);
        return;
      }
      lastFrame = now;
      drawSlit(now * 0.001);
      raf = requestAnimationFrame(tick);
    }

    function start() {
      wrap.classList.add('is-slit-on');
      seed = 42;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(tick);
    }

    function stop() {
      cancelAnimationFrame(raf);
      wrap.classList.remove('is-slit-on');
    }

    function onResize() {
      sourceData = null;
    }

    function boot() {
      if (!img.complete || !img.naturalWidth) return;
      start();
    }

    if (img.complete && img.naturalWidth) boot();
    else img.addEventListener('load', boot, { once: true });

    var resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(onResize, 160);
    });

    if (reduceMotion && reduceMotion.addEventListener) {
      reduceMotion.addEventListener('change', function () {
        if (reduceMotion.matches) stop();
        else boot();
      });
    }

    // Pause when hero leaves the viewport
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(
        function (entries) {
          var visible = entries.some(function (e) {
            return e.isIntersecting;
          });
          if (visible) boot();
          else stop();
        },
        { threshold: 0.15 }
      );
      io.observe(wrap);
    }
  })();

  // Mobile literacy carousel: 1) copy+lead, then each compact stat
  Array.prototype.forEach.call(document.querySelectorAll('.l-literacy-layout'), function (wrap) {
    var track = wrap.querySelector('.l-literacy-track');
    var dotsHost = wrap.querySelector('.l-facts-dots');
    if (!track || !dotsHost) return;

    var slides = Array.prototype.slice.call(track.querySelectorAll('.l-literacy-slide'));
    if (!slides.length) return;

    dotsHost.innerHTML = slides
      .map(function (_, i) {
        return (
          '<button type="button" aria-label="Slide ' +
          (i + 1) +
          '"' +
          (i === 0 ? ' class="is-active"' : '') +
          '></button>'
        );
      })
      .join('');

    var dots = Array.prototype.slice.call(dotsHost.querySelectorAll('button'));
    var desktopMq = window.matchMedia('(min-width: 960px)');

    function setActive(index) {
      dots.forEach(function (dot, i) {
        dot.classList.toggle('is-active', i === index);
      });
    }

    function nearestIndex() {
      var left = track.scrollLeft;
      var best = 0;
      var bestDist = Infinity;
      slides.forEach(function (slide, i) {
        var dist = Math.abs(slide.offsetLeft - left);
        if (dist < bestDist) {
          bestDist = dist;
          best = i;
        }
      });
      return best;
    }

    var scrollTick = null;
    track.addEventListener(
      'scroll',
      function () {
        if (desktopMq.matches) return;
        if (scrollTick) return;
        scrollTick = window.requestAnimationFrame(function () {
          scrollTick = null;
          setActive(nearestIndex());
        });
      },
      { passive: true }
    );

    dots.forEach(function (dot, i) {
      dot.addEventListener('click', function () {
        if (desktopMq.matches) return;
        track.scrollTo({ left: slides[i].offsetLeft, behavior: 'smooth' });
        setActive(i);
      });
    });
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
  var storyGlitchPane = document.getElementById('l-night-story-glitch');
  var storyGlitchImg = document.getElementById('l-night-story-glitch-img');
  var storyGlitchMq = window.matchMedia
    ? window.matchMedia('(min-width: 768px)')
    : null;
  var STORY_GLITCH_POOL = [
    '/assets/landing/story/nicole-garden.webp',
    '/assets/landing/story/nicole_sad_bg.webp',
    '/assets/landing/story/nicole_party.webp',
  ];
  var storyGlitchInst = null;
  var storyGlitchMountRun = 0;
  var storyGlitchTimer = null;
  var storyGlitchBusy = false;
  var storyGlitchPoolIndex = 0;
  var storyGlitchWanted = false;

  function isStoryGlitchDesktop() {
    try {
      return !!(storyGlitchMq && storyGlitchMq.matches);
    } catch (e) {
      return false;
    }
  }

  function waitImgReady(img) {
    if (!img) return Promise.reject(new Error('missing img'));
    if (img.complete && img.naturalWidth > 0) return Promise.resolve(img);
    return new Promise(function (resolve, reject) {
      img.addEventListener('load', function () {
        resolve(img);
      }, { once: true });
      img.addEventListener('error', function () {
        reject(new Error('img load failed'));
      }, { once: true });
    });
  }

  function storyGlitchOptions(target) {
    return {
      target: target,
      intensity: 3.0,
      aspectCorrection: true,
      interaction: {
        enabled: true,
        shape: 'square',
        customSize: '40vw',
        customUrl: '/assets/landing/brand/logo.svg',
        velocity: false,
        effects: {
          pixelation: ['pixelSize'],
          crt: [
            'chromaticAberration',
            'phosphorGlow',
            'curvature',
            'scanlines',
          ],
          glitch: [
            'rgbShift',
            'lineDisplacement',
            'bitCrushing',
            'signalDropout',
            'syncErrors',
            'interferenceLines',
            'frameGhosting',
            'stutterFreeze',
            'datamoshing',
          ],
        },
      },
      effects: {
        pixelation: {
          enabled: true,
          pixelSize: 7,
          pixelShape: 'square',
          bitDepth: 'none',
          dithering: 'none',
          pixelDirection: 'square',
        },
        crt: {
          enabled: true,
          preset: 'computer-monitor',
          curvature: 6,
          lineDirection: 'right',
          lineMovement: true,
          lineSpeed: 0.38,
        },
        glitch: {
          enabled: true,
          rgbShift: 0,
          digitalNoise: 0.18,
          lineDisplacement: 0,
          bitCrushDepth: 0,
          signalDropoutFreq: 0.03,
          signalDropoutSize: 0.4,
          syncErrorFreq: 0.1,
          syncErrorAmount: 0.141,
          interferenceSpeed: 5.2,
          interferenceIntensity: 1,
          frameGhostAmount: 0.68,
          stutterFreq: 0.4,
          datamoshStrength: 2,
        },
      },
    };
  }

  function cleanupStoryGlitchCanvas() {
    if (!storyGlitchPane) return;
    Array.prototype.slice
      .call(storyGlitchPane.querySelectorAll('canvas, [data-glitch-target]'))
      .forEach(function (node) {
        if (node === storyGlitchImg) return;
        if (node.parentNode) node.parentNode.removeChild(node);
      });
  }

  function stopStoryGlitchCycle() {
    if (storyGlitchTimer) {
      clearTimeout(storyGlitchTimer);
      storyGlitchTimer = null;
    }
  }

  function teardownStoryGlitch() {
    storyGlitchMountRun += 1;
    stopStoryGlitchCycle();
    storyGlitchBusy = false;
    var inst = storyGlitchInst;
    storyGlitchInst = null;
    storyCard.classList.remove('is-glitch-on');
    if (inst && typeof inst.cleanup === 'function') {
      try {
        inst.cleanup();
      } catch (e) {
        /* ignore */
      }
    }
    cleanupStoryGlitchCanvas();
  }

  function mountStoryGlitchInstance() {
    if (typeof window.glitchGL !== 'function' || typeof window.THREE === 'undefined') {
      return null;
    }
    cleanupStoryGlitchCanvas();
    return window.glitchGL(storyGlitchOptions('#l-night-story-glitch-img'));
  }

  function nextStoryGlitchSrc() {
    storyGlitchPoolIndex = (storyGlitchPoolIndex + 1) % STORY_GLITCH_POOL.length;
    return STORY_GLITCH_POOL[storyGlitchPoolIndex];
  }

  function advanceStoryGlitch() {
    if (!storyGlitchInst || !storyGlitchImg || storyGlitchBusy) {
      return Promise.resolve();
    }
    if (!storyGlitchWanted || !isStoryGlitchDesktop()) {
      return Promise.resolve();
    }
    storyGlitchBusy = true;
    var run = storyGlitchMountRun;
    var src = nextStoryGlitchSrc();
    var probe = new Image();
    probe.src = src;
    return waitImgReady(probe)
      .then(function () {
        if (run !== storyGlitchMountRun || !storyGlitchInst) return;
        if (storyGlitchInst && typeof storyGlitchInst.cleanup === 'function') {
          try {
            storyGlitchInst.cleanup();
          } catch (e) {
            /* ignore */
          }
        }
        storyGlitchInst = null;
        cleanupStoryGlitchCanvas();
        storyGlitchImg.src = src;
        return waitImgReady(storyGlitchImg);
      })
      .then(function () {
        if (run !== storyGlitchMountRun || !storyGlitchWanted) return;
        try {
          storyGlitchInst = mountStoryGlitchInstance();
        } catch (e) {
          storyGlitchInst = null;
        }
      })
      .catch(function () {
        /* ignore swap errors */
      })
      .finally(function () {
        storyGlitchBusy = false;
      });
  }

  function scheduleStoryGlitchCycle() {
    stopStoryGlitchCycle();
    if (!storyGlitchInst || !storyGlitchWanted) return;
    var run = storyGlitchMountRun;
    var delay = 5200 + Math.floor(Math.random() * 2800);
    storyGlitchTimer = setTimeout(function () {
      if (run !== storyGlitchMountRun) return;
      advanceStoryGlitch().finally(function () {
        if (run !== storyGlitchMountRun) return;
        if (!storyGlitchInst || !storyGlitchWanted) return;
        scheduleStoryGlitchCycle();
      });
    }, delay);
  }

  function mountStoryGlitch() {
    if (storyGlitchInst || !storyGlitchWanted || !isStoryGlitchDesktop()) return;
    if (!storyGlitchPane || !storyGlitchImg) return;
    if (typeof window.glitchGL !== 'function' || typeof window.THREE === 'undefined') {
      return;
    }

    storyGlitchMountRun += 1;
    var run = storyGlitchMountRun;
    storyCard.classList.add('is-glitch-on');

    waitImgReady(storyGlitchImg)
      .then(function () {
        if (run !== storyGlitchMountRun || storyGlitchInst) return;
        if (!storyGlitchWanted || !isStoryGlitchDesktop()) return;
        try {
          storyGlitchInst = mountStoryGlitchInstance();
          scheduleStoryGlitchCycle();
        } catch (e) {
          storyGlitchInst = null;
        }
      })
      .catch(function () {
        /* ignore */
      });
  }

  function syncStoryGlitch(on) {
    storyGlitchWanted = !!on;
    if (!on || !isStoryGlitchDesktop()) {
      teardownStoryGlitch();
      return;
    }
    if (storyGlitchInst) {
      storyCard.classList.add('is-glitch-on');
      return;
    }
    requestAnimationFrame(function () {
      mountStoryGlitch();
    });
  }

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
        syncStoryGlitch(p > 0.85);
        if (p >= 0.92) playStoryBody();
        else if (p < 0.5 && storyBodyPlayed) resetStoryBody();
      },
      onComplete: function () {
        storyCard.classList.add('is-wide', 'is-fullbleed');
        nightsSection.classList.add('is-story-full');
        syncStoryGlitch(true);
        playStoryBody();
      },
      onReverseComplete: function () {
        storyCard.classList.remove('is-wide', 'is-fullbleed');
        nightsSection.classList.remove('is-story-full');
        syncStoryGlitch(false);
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
    if (!isStoryGlitchDesktop()) syncStoryGlitch(false);
    else if (storyGlitchWanted) syncStoryGlitch(true);
  }

  var resizeTimer = null;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(refreshMotion, 180);
  });

  if (storyGlitchMq) {
    var onStoryGlitchMq = function () {
      if (!isStoryGlitchDesktop()) syncStoryGlitch(false);
      else if (storyCard.classList.contains('is-fullbleed')) syncStoryGlitch(true);
    };
    if (storyGlitchMq.addEventListener) {
      storyGlitchMq.addEventListener('change', onStoryGlitchMq);
    } else if (storyGlitchMq.addListener) {
      storyGlitchMq.addListener(onStoryGlitchMq);
    }
  }

  window.addEventListener('pagehide', function () {
    syncStoryGlitch(false);
  });

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(function () {
      refreshMotion();
    });
  }
})();

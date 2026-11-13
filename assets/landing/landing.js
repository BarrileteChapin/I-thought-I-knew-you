(function () {
  // Lite: phones / reduced-motion / very weak devices — skip canvas, WebGL, smooth scroll.
  var isLite =
    typeof window.__lLite === 'boolean'
      ? window.__lLite
      : (function () {
          try {
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return true;
            return window.matchMedia('(max-width: 900px)').matches;
          } catch (e) {
            return true;
          }
        })();

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

  // Pause hero video when off-screen (decode cost on phones)
  if (video && 'IntersectionObserver' in window) {
    var videoIo = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var playPromise = video.play();
            if (playPromise && typeof playPromise.catch === 'function') {
              playPromise.catch(function () {});
            }
          } else {
            video.pause();
          }
        });
      },
      { threshold: 0.2 }
    );
    videoIo.observe(video);
  }

  // Mobile mute: fixed bottom-left, fade out with scroll
  (function initMuteScrollFade() {
    if (!btn) return;
    var heroEl = document.getElementById('top');
    var mobileMq = window.matchMedia('(max-width: 899px)');

    function syncMuteFade() {
      if (!mobileMq.matches) {
        btn.style.opacity = '';
        btn.classList.remove('is-faded');
        btn.removeAttribute('aria-hidden');
        return;
      }
      var scrolled = window.scrollY || document.documentElement.scrollTop || 0;
      var fadeStart = 48;
      var fadeEnd = heroEl
        ? Math.min(260, Math.max(140, heroEl.offsetHeight * 0.28))
        : 200;
      var t = (scrolled - fadeStart) / Math.max(1, fadeEnd - fadeStart);
      if (t < 0) t = 0;
      if (t > 1) t = 1;
      var opacity = 1 - t;
      btn.style.opacity = String(opacity);
      var faded = opacity < 0.12;
      btn.classList.toggle('is-faded', faded);
      if (faded) btn.setAttribute('aria-hidden', 'true');
      else btn.removeAttribute('aria-hidden');
    }

    syncMuteFade();
    window.addEventListener('scroll', syncMuteFade, { passive: true });
    window.addEventListener('resize', syncMuteFade);
    if (mobileMq.addEventListener) {
      mobileMq.addEventListener('change', syncMuteFade);
    }

    var muteLenisTries = 0;
    var muteLenisHook = window.setInterval(function () {
      muteLenisTries += 1;
      if (window.__lLenis && typeof window.__lLenis.on === 'function') {
        window.__lLenis.on('scroll', syncMuteFade);
        window.clearInterval(muteLenisHook);
      } else if (muteLenisTries > 40) {
        window.clearInterval(muteLenisHook);
      }
    }, 100);
  })();

  // Media-literacy fact rows: speech bubbles (lead) or custom pictos
  var PICTO_BASE = '/assets/landing/pictos/';
  var PICTO_SETS = {
    phone: ['phone'],
    depressed: ['depressed'],
    school: ['school'],
    teacher: ['teacher'],
  };
  var BUBBLE_PATH =
    'M6 1.5C2.96 1.5.5 3.96.5 7v8c0 3.04 2.46 5.5 5.5 5.5h1.75v5.1l7.35-5.1H26c3.04 0 5.5-2.46 5.5-5.5V7c0-3.04-2.46-5.5-5.5-5.5H6z';

  Array.prototype.forEach.call(document.querySelectorAll('.l-people[data-total]'), function (el) {
    var filled = parseInt(el.getAttribute('data-filled') || '0', 10);
    var total = parseInt(el.getAttribute('data-total') || '0', 10);
    var setName = el.getAttribute('data-picto') || 'phone';
    var html = '';
    var i;

    if (setName === 'bubble') {
      for (i = 0; i < total; i += 1) {
        html +=
          '<svg class="l-people-picto l-people-bubble' +
          (i < filled ? ' is-on' : '') +
          '" viewBox="0 0 32 28" width="40" height="35" aria-hidden="true">' +
          '<path fill="currentColor" d="' +
          BUBBLE_PATH +
          '"></path></svg>';
      }
    } else {
      var set = PICTO_SETS[setName] || PICTO_SETS.phone;
      for (i = 0; i < total; i += 1) {
        var name = set[i % set.length];
        html +=
          '<img class="l-people-picto' +
          (i < filled ? ' is-on' : '') +
          '" src="' +
          PICTO_BASE +
          name +
          '.png" alt="" width="40" height="48" decoding="async" aria-hidden="true">';
      }
    }
    el.innerHTML = html;
  });

  // Hero: continuous incoming classmate messages (game chat row look)
  (function initHeroChatFeed() {
    var host = document.getElementById('l-hero-chat');
    if (!host) return;

    var AV = '/assets/landing/cast/';
    var FEED = [
      { who: 'Hanna', text: 'yo WHAT' },
      { who: 'Mia', text: '💀💀' },
      { who: 'Lea', text: 'wow. I thought I knew her' },
      { who: 'Hanna', text: 'sending this to the other groups' },
      { who: 'Mia', text: 'bowling or billiards' },
      { who: 'Benito', text: '👍' },
      { who: 'Hanna', text: 'ok so next week' },
      { who: 'Mia', text: 'has anyone actually done the chem thing' },
      { who: 'Lea', text: 'wait is this real' },
      { who: 'Hanna', text: 'no lol' },
      { who: 'Nicole', text: 'please tell me you don\u2019t believe this' },
      { who: 'Mia', text: 'free food' },
      { who: 'Hanna', text: 'checked WHAT it\u2019s right there' },
      { who: 'Lea', text: 'I thought I knew you' },
      { who: 'Benito', text: 'this is messy' },
      { who: 'Mia', text: 'everyone\u2019s invited' },
    ];

    var MAX_VISIBLE = 2;
    var index = 0;
    var timer = null;
    var feedActive = true;
    var hero = document.getElementById('top');
    var reduceMotion =
      window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function slug(who) {
      return String(who || 'mia').toLowerCase();
    }

    function avatarSrc(who) {
      var s = slug(who);
      if (s === 'hanna') return AV + 'av-hanna.webp';
      if (s === 'lea') return AV + 'av-lea.webp';
      if (s === 'benito') return AV + 'av-benito.webp';
      if (s === 'nicole') return AV + 'av-nicole.webp';
      return AV + 'av-mia.webp';
    }

    function makeRow(msg) {
      var row = document.createElement('div');
      row.className = 'l-chat-row';
      row.innerHTML =
        '<img class="l-chat-av" src="' +
        avatarSrc(msg.who) +
        '" alt="" width="48" height="48" decoding="async">' +
        '<div class="l-chat-bubble">' +
        '<div class="l-chat-who l-chat-who--' +
        slug(msg.who) +
        '">' +
        msg.who +
        '</div>' +
        '<div class="l-chat-text"></div>' +
        '</div>';
      row.querySelector('.l-chat-text').textContent = msg.text;
      return row;
    }

    function pushNext() {
      if (!feedActive || host.classList.contains('is-away')) return;
      var msg = FEED[index % FEED.length];
      index += 1;

      var row = makeRow(msg);
      host.appendChild(row);
      void row.offsetWidth;
      row.classList.add('is-in');

      while (host.children.length > MAX_VISIBLE) {
        var oldest = host.children[0];
        if (oldest.classList.contains('is-out')) {
          if (oldest.parentNode) oldest.parentNode.removeChild(oldest);
          continue;
        }
        oldest.classList.remove('is-in');
        oldest.classList.add('is-out');
        (function (node) {
          window.setTimeout(function () {
            if (node.parentNode) node.parentNode.removeChild(node);
          }, reduceMotion ? 0 : 400);
        })(oldest);
        break;
      }
    }

    function schedule() {
      stop();
      if (!feedActive || host.classList.contains('is-away')) return;
      var delay = reduceMotion ? 10000 : 2200 + Math.floor(Math.random() * 1600);
      timer = window.setTimeout(function () {
        pushNext();
        schedule();
      }, delay);
    }

    function stop() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    }

    function startFeed() {
      feedActive = true;
      if (!host.children.length) {
        pushNext();
        if (!reduceMotion) {
          window.setTimeout(function () {
            if (feedActive && !host.classList.contains('is-away')) pushNext();
          }, 700);
        } else {
          pushNext();
        }
      }
      schedule();
    }

    function syncChatAway() {
      if (!hero) return;
      var rect = hero.getBoundingClientRect();
      var fadeRange = Math.min(window.innerHeight * 0.28, Math.max(120, hero.offsetHeight * 0.22));
      var scrolled = Math.max(0, -rect.top);
      var away = scrolled > fadeRange * 0.35;
      var wasAway = host.classList.contains('is-away');
      host.classList.toggle('is-away', away);
      if (away) {
        feedActive = false;
        stop();
      } else if (wasAway || !timer) {
        startFeed();
      }
    }

    startFeed();
    syncChatAway();

    window.addEventListener('scroll', syncChatAway, { passive: true });
    window.addEventListener('resize', syncChatAway);
    // Lenis may exist later; hook when available
    var lenisHookTries = 0;
    var lenisHook = window.setInterval(function () {
      lenisHookTries += 1;
      if (window.__lLenis && typeof window.__lLenis.on === 'function') {
        window.__lLenis.on('scroll', syncChatAway);
        window.clearInterval(lenisHook);
      } else if (lenisHookTries > 40) {
        window.clearInterval(lenisHook);
      }
    }, 100);

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) stop();
      else if (feedActive && !host.classList.contains('is-away')) schedule();
    });
  })();

  // Hero logo: slit-scan displacement (same idea as karinkiho.com/en/experiment/slit)
  // Skipped on lite — per-pixel canvas every frame is too heavy for phones.
  (function initHeroLogoSlit() {
    if (isLite) return;
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
          // Clamp sample X so the logo's left/right ink isn't eaten into transparency
          var sx = Math.round(x - offset);
          if (sx < 0) sx = 0;
          else if (sx >= w) sx = w - 1;
          var di = (y * w + x) << 2;
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

  // —— Lenis (desktop only; native scroll on lite) ——
  var lenis = null;
  if (!isLite && typeof Lenis === 'function') {
    lenis = new Lenis({
      duration: 1.1,
      smoothWheel: true,
      touchMultiplier: 1.1,
    });
    window.__lLenis = lenis;
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
  // SplitText DOM explosion skipped on lite.
  if (!isLite && hasSplitText && typeof ScrollTrigger !== 'undefined') {
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
  // When scale locks, run fact pictogram reveal once.
  function playFactReveal(section) {
    var facts = section.querySelectorAll('.l-fact');
    Array.prototype.forEach.call(facts, function (fact, factIndex) {
      if (fact.classList.contains('is-animated')) return;
      fact.classList.add('is-animated');

      var icons = fact.querySelectorAll('.l-people-picto');
      var delay = factIndex * 0.08;

      if (icons.length) {
        gsap.to(icons, {
          opacity: function (_i, target) {
            return target.classList.contains('is-on') ? 1 : 0.2;
          },
          y: 0,
          scale: 1,
          duration: 0.45,
          stagger: 0.06,
          delay: delay,
          ease: 'power3.out',
          clearProps: 'transform',
        });
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

  function playPanelSettle(el) {
    playFactReveal(el);
  }

  // —— Film: custom poster until play ——
  (function initFilmPosterPlay() {
    var slot = document.querySelector('.l-film-slot[data-yt-id]');
    var player = document.getElementById('l-film-player');
    var poster = document.getElementById('l-film-poster');
    if (!slot || !player || !poster) return;

    var ytId = slot.getAttribute('data-yt-id');
    if (!ytId) return;
    var started = false;

    function startFilm() {
      if (started) return;
      started = true;
      var iframe = document.createElement('iframe');
      iframe.className = 'l-film-embed';
      iframe.title = 'Introduction about the game';
      iframe.allow =
        'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      iframe.setAttribute('allowfullscreen', '');
      iframe.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      iframe.src =
        'https://www.youtube-nocookie.com/embed/' +
        encodeURIComponent(ytId) +
        '?autoplay=1&rel=0';
      player.innerHTML = '';
      player.appendChild(iframe);
    }

    poster.addEventListener('click', startFilm);
  })();

  // —— SIFT: draw horizontal rail on scroll + slow circle reveal ——
  (function initSiftReveal() {
    var section = document.getElementById('method');
    var steps = section
      ? Array.prototype.slice.call(section.querySelectorAll('.l-sift-step'))
      : [];
    var railDraw = document.getElementById('l-sift-rail-draw');
    if (!section || !steps.length) return;
    if (typeof ScrollTrigger === 'undefined' || typeof gsap === 'undefined') return;

    var reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    var rowMq = window.matchMedia('(min-width: 720px)');
    var played = false;

    function playSteps() {
      if (played) return;
      played = true;
      if (reduceMq.matches) {
        gsap.set(steps, { clearProps: 'transform,opacity' });
        return;
      }
      gsap.to(steps, {
        opacity: 1,
        y: 0,
        duration: 0.85,
        stagger: 0.22,
        ease: 'power3.out',
      });
    }

    gsap.set(steps, { opacity: 0, y: 28 });

    ScrollTrigger.create({
      trigger: section,
      start: 'top 68%',
      once: true,
      onEnter: playSteps,
    });

    if (railDraw) {
      if (reduceMq.matches) {
        gsap.set(railDraw, { scaleX: 1 });
      } else {
        gsap.set(railDraw, { scaleX: 0, transformOrigin: 'left center' });
        gsap.to(railDraw, {
          scaleX: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: section,
            start: 'top 72%',
            end: 'top 28%',
            scrub: 0.45,
            invalidateOnRefresh: true,
            onUpdate: function () {
              if (!rowMq.matches) gsap.set(railDraw, { scaleX: 0 });
            },
          },
        });
      }
    }
  })();

  // —— Nights: vertical scroll drives horizontal rail until Thursday ——
  (function initNightsScrub() {
    var nightsSection = document.getElementById('project');
    var nightsPin = nightsSection && nightsSection.querySelector('.l-nights-pin');
    var nightsRail = nightsSection && nightsSection.querySelector('.l-nights-rail');
    var nightsTrack = document.getElementById('l-nights-track');
    if (!nightsSection || !nightsPin || !nightsRail || !nightsTrack) return;
    if (typeof ScrollTrigger === 'undefined' || typeof gsap === 'undefined') return;

    var nightCards = Array.prototype.slice.call(
      nightsTrack.querySelectorAll('.l-night-card')
    );
    if (!nightCards.length) return;

    var reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    var scrubTween = null;

    function scrollDist() {
      var last = nightCards[nightCards.length - 1];
      if (!last) return 0;
      var railStyle = window.getComputedStyle(nightsRail);
      var padL = parseFloat(railStyle.paddingLeft) || 0;
      var padR = parseFloat(railStyle.paddingRight) || 0;
      var visible = Math.max(0, nightsRail.clientWidth - padL - padR);
      // Stop when Thursday's right edge meets the rail's content right — no dead margin after
      var endX = last.offsetLeft + last.offsetWidth;
      return Math.max(0, endX - visible);
    }

    function isMobileNights() {
      try {
        return window.matchMedia('(max-width: 899px)').matches;
      } catch (e) {
        return false;
      }
    }

    // Vertical travel for the scrub. 1:1 with horizontal px feels endless on phones.
    function scrubTravel(dist) {
      if (!isMobileNights()) return dist;
      var vh = window.innerHeight || 1;
      // ~one viewport of scroll to cross all four days — snappier, still readable
      return Math.round(Math.min(dist, Math.max(vh * 0.95, dist * 0.62)));
    }

    function killScrub() {
      if (scrubTween) {
        if (scrubTween.scrollTrigger) scrubTween.scrollTrigger.kill();
        scrubTween.kill();
        scrubTween = null;
      }
      gsap.set(nightsTrack, { x: 0, clearProps: 'transform' });
      nightsPin.style.height = '';
      nightsSection.classList.remove('is-nights-scrub');
      nightsSection.classList.remove('is-nights-native');
    }

    function setupScrub() {
      killScrub();

      if (reduceMq.matches) {
        nightsSection.classList.add('is-nights-native');
        return;
      }

      var dist = scrollDist();
      // Desktop with all four cards visible: no horizontal travel
      if (dist < 12) {
        nightsSection.classList.remove('is-nights-scrub');
        return;
      }

      nightsSection.classList.add('is-nights-scrub');
      gsap.set(nightsTrack, { x: 0, force3D: true });

      var railH = nightsRail.offsetHeight;
      var travel = scrubTravel(dist);
      nightsPin.style.height = railH + travel + 'px';

      scrubTween = gsap.fromTo(
        nightsTrack,
        { x: 0 },
        {
          x: -dist,
          ease: 'none',
          scrollTrigger: {
            trigger: nightsPin,
            // Keep start at viewport top; CSS sticky `top` only clears the header
            start: 'top top',
            end: function () {
              return '+=' + scrubTravel(scrollDist());
            },
            scrub: isMobileNights() ? true : 0.3,
            invalidateOnRefresh: true,
            onRefresh: function () {
              var d = scrollDist();
              var h = nightsRail.offsetHeight;
              var t = scrubTravel(d);
              nightsPin.style.height = h + t + 'px';
              if (scrubTween) scrubTween.vars.x = -d;
            },
          },
        }
      );
    }

    setupScrub();

    var resizeTimer = null;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        setupScrub();
        ScrollTrigger.refresh();
      }, 180);
    });

    if (reduceMq.addEventListener) {
      reduceMq.addEventListener('change', function () {
        setupScrub();
        ScrollTrigger.refresh();
      });
    }
  })();

  // —— Story section (after film): heading + line reveal (glitch off for now) ——
  (function initStorySection() {
    var storySection = document.getElementById('story');
    if (!storySection) return;
    if (typeof ScrollTrigger === 'undefined' || typeof gsap === 'undefined') return;

    var storyLineEls = Array.prototype.slice.call(
      storySection.querySelectorAll('[data-story-line]')
    );
    var storyHeading = storySection.querySelector('.l-night-story-heading');
    var reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
    var HEADING_REST = 0.55;
    var storyPlayed = false;
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

    function playStoryMotion() {
      if (storyPlayed) return;
      storyPlayed = true;

      if (reduceMq.matches) {
        if (storyHeading) gsap.set(storyHeading, { scale: 1, opacity: 1 });
        if (storyLineEls.length) gsap.set(storyLineEls, { opacity: 1, y: 0 });
        storyBodyPlayed = true;
        return;
      }

      var tl = gsap.timeline({
        defaults: { ease: 'power3.out' },
      });

      if (storyHeading) {
        tl.to(storyHeading, {
          scale: 1,
          duration: 0.95,
          ease: 'power2.out',
        }, 0);
      }

      tl.add(function () {
        playStoryBody();
      }, storyHeading ? 0.55 : 0);
    }

    if (storyHeading) {
      gsap.set(storyHeading, {
        scale: HEADING_REST,
        transformOrigin: '50% 50%',
      });
    }
    if (storyLineEls.length) {
      gsap.set(storyLineEls, { opacity: 0, y: 16 });
    }

    ScrollTrigger.create({
      trigger: storySection,
      start: 'top 72%',
      once: true,
      onEnter: playStoryMotion,
    });
  })();
})();

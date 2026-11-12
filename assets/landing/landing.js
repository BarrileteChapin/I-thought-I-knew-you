(function () {
  var video = document.getElementById('l-intro-video');
  var btn = document.getElementById('l-intro-mute');
  if (!video || !btn) return;

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
})();

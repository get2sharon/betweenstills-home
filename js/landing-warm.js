/* ── The static front page of betweenstills.com. ─────────────────────────────
   Derived from the product's landing-warm.js, with the price slider removed and
   the pause-button words held here, since there is no server to supply them.
   Nothing on this page talks to a server.                                      */
(function () {
"use strict";

var W = {
  pause: "השהיה", play: "ניגון",
  pause_clip: "השהיית הקטע", play_clip: "ניגון הקטע",
  pause_film: "השהיית הסרט", play_film: "ניגון הסרט"
};

/* ── The pause buttons. WCAG 2.2.2: anything that starts moving on its own and
      runs for more than five seconds needs a way to stop it.
      There are three films on this page that play by themselves, and each has its
      own button sitting on the film it controls. The hero's button once stopped
      the clip in the second section too — off screen at the time — and would then
      start it again after the visitor had paused it down there. ─────────────── */
var STATES = [];

function relabel(st) {
  document.getElementById(st.iconId).textContent = st.paused ? "▶" : "❙❙";
  document.getElementById(st.wordId).textContent = st.paused ? W.play : W.pause;
  st.b.setAttribute("aria-label", st.paused ? st.playLabel : st.pauseLabel);
}

function wire(videoId, btnId, iconId, wordId, pauseLabel, playLabel) {
  var v = document.getElementById(videoId);
  var b = document.getElementById(btnId);
  if (!v || !b) return null;
  var st = { v: v, paused: false, b: b, iconId: iconId, wordId: wordId,
             pauseLabel: pauseLabel, playLabel: playLabel };
  b.addEventListener("click", function () {
    st.paused = !st.paused;
    if (st.paused) { v.pause(); } else { var p = v.play(); if (p) p.catch(function () {}); }
    relabel(st);
  });
  /* Try again to play. A browser stops video in a hidden tab, and the autoplay
     policy can refuse the first call outright. Without this the film just stops. */
  var kick = function () {
    if (!st.paused && document.visibilityState === "visible") {
      var p = v.play(); if (p) p.catch(function () {});
    }
  };
  ["canplay", "loadeddata"].forEach(function (e) { v.addEventListener(e, kick); });
  addEventListener("visibilitychange", kick);
  addEventListener("pageshow", kick);
  /* prefers-reduced-motion: do not start playing on our own. */
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) b.click();
  return st;
}

STATES.push(wire("hero", "pause", "pauseIcon", "pauseWord", W.pause_film, W.play_film));
var clipState = wire("clip", "pause2", "pauseIcon2", "pauseWord2", W.pause_clip, W.play_clip);
STATES.push(clipState);
/* The third film, the one in the four cells. The same wire exactly: one button to
   one film, and the three buttons never touch each other. */
STATES.push(wire("film4", "pause3", "pauseIcon3", "pauseWord3", W.pause_film, W.play_film));

/* ── The playhead on the film strip. Its position is read off the video itself
      and not off a timer of our own, so pausing stops the playhead too and there
      are never two clocks drifting apart. ─────────────────────────────────── */
(function playhead() {
  var strip = document.getElementById("strip");
  var v = clipState && clipState.v;
  if (!strip || !v) return;
  (function paint() {
    var d = v.duration;
    if (d && isFinite(d)) {
      strip.style.setProperty("--p", Math.min(1, v.currentTime / d).toFixed(4));
    }
    requestAnimationFrame(paint);
  })();
})();

/* ── The four cells. The window that is playing travels between them, in the
      reading direction. The video does NOT move in the DOM — only the grid cell
      it occupies changes — so the film runs from 0 to 20 with no seam while the
      layout changes under it. ─────────────────────────────────────────────── */
var fbV      = document.getElementById("film4");
var fbLive   = document.getElementById("fbLive");
var fbStrip  = document.getElementById("fbStrip");
var fbBand   = fbStrip && fbStrip.parentElement;
var fbStills = [].slice.call(document.querySelectorAll(".fb-still"));
var fbNarrow = matchMedia("(max-width:860px)");
var fbStep   = matchMedia("(max-width:1100px)");
var fbActive = -1, fbRepaint = null;

/* The ratio is read out of the CSS and not held here in a second copy, so the
   breakpoint lives in one place only. */
function fbLead() {
  var v = fbBand ? getComputedStyle(fbBand).getPropertyValue("--fb-lead").trim() : "";
  return v || "4";
}
function fbSyncTag() {
  var t = document.getElementById("fbLiveTag");
  if (t) t.textContent = String(Math.max(0, fbActive) + 1);
}
function fbPlace(i) {
  if (!fbStrip || i === fbActive) return;
  fbActive = i;
  if (!fbNarrow.matches) {
    var lead = fbLead();
    fbLive.style.gridColumn = String(i + 1);
    fbLive.style.gridRow    = "1";
    fbStills.forEach(function (s, k) { s.style.gridColumn = String(k + 1); s.style.gridRow = "1"; });
    fbStrip.style.gridTemplateColumns =
      [0, 1, 2, 3].map(function (k) { return k === i ? lead + "fr" : "1fr"; }).join(" ");
  } else {
    fbStrip.style.gridTemplateColumns = "";
    fbStills.forEach(function (s, k) {
      s.style.gridColumn = String((k % 2) + 1);
      s.style.gridRow    = String(Math.floor(k / 2) + 1);
    });
    fbLive.style.gridColumn = String((i % 2) + 1);
    fbLive.style.gridRow    = String(Math.floor(i / 2) + 1);
  }
  fbStills.forEach(function (s, k) {
    s.classList.toggle("is-hidden", k === i);
    s.classList.toggle("is-done",   k <  i);
  });
  fbSyncTag();
}

/* ── The stills: four frames out of the file itself, zero new assets ─────────
   The mockup this came from grabbed them by SEEKING to the quarter marks. That
   breaks here, and this is measured and not a guess:
   • the seek simply does not happen — currentTime stays 0 after four seeks, and
     `seekable` is an empty range;
   • the reason: the server answers a Range request with 200 and not 206, so you
     cannot jump into the middle of a file that has not fully arrived;
   • a paused video never downloads the whole file — the browser suspends the
     fetch after about five seconds of material. Waiting on `buffered` waited
     twenty seconds and failed. So seeking in a hidden, paused video cannot work
     here at all, and when it did work it was only because the visible film had
     already pulled the file down.

   So there is no seeking. The hidden video plays once at 16x, and every frame it
   shows is checked against the quarter boundaries — whichever crosses one is
   caught. Measured: four different frames in four runs out of four, including the
   worst case of a file downloading from zero, inside one second. The frames are
   kept, so moving between wide and narrow redraws from them without touching the
   video again. */
var fbFrames = [];
if (fbV) (function fbPaintStills() {
  var g = document.createElement("video");
  g.src = fbV.currentSrc || fbV.src; g.muted = true; g.playsInline = true;
  g.preload = "auto";
  /* Opened straight from disk, a cross-origin request would be refused. A canvas
     that was only drawn to and never read back is fine either way. */
  if (location.protocol !== "file:") g.crossOrigin = "anonymous";
  /* Two pixels at one percent opacity. The video has to be in the tree and
     displayed to play and show frames; display:none would stop that. */
  g.setAttribute("aria-hidden", "true");
  g.style.cssText = "position:fixed;left:0;top:0;width:2px;height:2px;" +
                    "opacity:.01;pointer-events:none;z-index:-1";
  document.body.appendChild(g);

  /* Drawing from the kept frames. No video is involved, so it is immediate and
     safe to call again on every change between wide and narrow. */
  fbRepaint = function () {
    var wide = !fbNarrow.matches;
    fbFrames.forEach(function (f, k) {
      var c = fbStills[k] && fbStills[k].querySelector("canvas");
      if (!c || !f) return;
      c.width = 520; c.height = wide ? 520 : 293;
      /* Wide, the print is square, so crop from the centre exactly as
         object-fit:cover would. Narrow it is 16:9 and nothing is cropped. */
      var sw = wide ? Math.min(f.width, f.height) : f.width;
      var sh = wide ? sw : f.height;
      c.getContext("2d").drawImage(f, (f.width - sw) / 2, (f.height - sh) / 2,
                                      sw, sh, 0, 0, c.width, c.height);
    });
  };

  g.addEventListener("loadeddata", function () {
    var d = g.duration; if (!d || !isFinite(d)) return;
    var q = d / 4, want = [0, q, 2 * q, 3 * q];
    var k = 0;
    g.playbackRate = 16;            /* Chrome's ceiling. Twenty seconds in about one. */
    var started = g.play();
    if (!started) return;
    started.then(function () {
      var done = function () { g.pause(); g.remove(); fbRepaint(); };
      var finished = false;
      var finish = function () { if (!finished) { finished = true; done(); } };
      var grab = function () {
        /* A loop and not an if: at 16x one displayed frame can cross more than
           one boundary, and the second would have fallen between the chairs. */
        while (k < 4 && g.currentTime >= want[k]) {
          var f = document.createElement("canvas");
          /* Half resolution. The square crop comes out at 540 and the largest
             print on the page is 520 — so nothing is being blown up. */
          f.width = 960; f.height = 540;
          f.getContext("2d").drawImage(g, 0, 0, f.width, f.height);
          fbFrames[k] = f; k++;
        }
        if (k >= 4) return finish();
        if (g.requestVideoFrameCallback) g.requestVideoFrameCallback(grab);
        else requestAnimationFrame(grab);
      };
      grab();
      setTimeout(finish, 15000);
    }).catch(function () { g.remove(); });
  });
})();

/* The state is read off the video itself and not off a timer of our own, so
   pausing stops the travel too and there are never two clocks drifting apart. */
if (fbV) (function fbPaint() {
  var d = fbV.duration;
  if (d && isFinite(d)) {
    var q = d / 4;
    var i = Math.min(3, Math.floor(fbV.currentTime / q));
    fbPlace(i);
    fbLive.style.setProperty("--fb-p",
      Math.min(1, Math.max(0, (fbV.currentTime - i * q) / q)).toFixed(4));
  }
  requestAnimationFrame(fbPaint);
})();
fbPlace(0);
/* Two breakpoints move the layout, and fbPlace returns early when the index has
   not changed — so they are crossed by force. */
[fbNarrow, fbStep].forEach(function (m) {
  m.addEventListener("change", function () {
    var i = Math.max(0, fbActive); fbActive = -1; fbPlace(i);
    /* Narrow, the print is 16:9 and not a square, so redraw from the frames. */
    if (m === fbNarrow && fbRepaint) fbRepaint();
  });
});


})();

(function () {
  var deck = document.getElementById("deck");
  if (!deck) return;
  var slides = [].slice.call(deck.querySelectorAll(".slide"));
  var bar = document.querySelector(".deck-progress > span");
  var idxEl = document.getElementById("deck-idx");
  var chaptersBox = document.getElementById("deck-chapters-ticks");
  var chaptersCfgEl = document.getElementById("deck-chapters-config");
  var i = 0;
  var chapters = [];
  var tickBtns = [];

  if (chaptersCfgEl && chaptersCfgEl.textContent) {
    try {
      chapters = JSON.parse(chaptersCfgEl.textContent);
    } catch (err) {
      chapters = [];
    }
  }

  function updateChapterTicks() {
    tickBtns.forEach(function (btn, idx) {
      var start = Math.max(0, Math.min((chapters[idx].slide || 1) - 1, slides.length - 1));
      var nextStart =
        idx + 1 < chapters.length
          ? Math.max(0, Math.min(chapters[idx + 1].slide - 1, slides.length))
          : slides.length;
      var active = i >= start && i < nextStart;
      btn.classList.toggle("is-active", active);
    });
  }

  function show(n) {
    i = Math.max(0, Math.min(n, slides.length - 1));
    slides.forEach(function (s, j) {
      s.classList.toggle("is-on", j === i);
    });
    if (bar) bar.style.width = ((100 * (i + 1)) / slides.length).toFixed(2) + "%";
    if (idxEl) idxEl.textContent = i + 1 + " / " + slides.length;
    updateChapterTicks();
  }

  function buildChapterTicks() {
    if (!chaptersBox || !chapters.length) return;
    var denom = Math.max(1, slides.length - 1);
    chaptersBox.innerHTML = "";
    tickBtns = [];
    chapters.forEach(function (ch) {
      var idx0 = Math.max(0, Math.min((ch.slide || 1) - 1, slides.length - 1));
      var pct = (idx0 / denom) * 100;
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "deck-chapter-tick";
      btn.style.left = pct + "%";
      var label = (ch.label || "章节").trim();
      var hint = (ch.hint && String(ch.hint).trim()) || label;
      btn.title = hint + "（第 " + (idx0 + 1) + " 页）";
      btn.setAttribute("aria-label", "跳到：" + hint);
      var lab = document.createElement("span");
      lab.className = "deck-chapter-tick__label";
      lab.textContent = label;
      btn.appendChild(lab);
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        show(idx0);
      });
      chaptersBox.appendChild(btn);
      tickBtns.push(btn);
    });
    updateChapterTicks();
  }

  buildChapterTicks();

  deck.addEventListener("click", function (e) {
    if (e.target.closest("a, button, iframe, input, textarea, select")) return;
    show(i + 1);
  });

  document.addEventListener("keydown", function (e) {
    if (e.target.closest("input, textarea")) return;
    if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown" || e.key === "Enter") {
      e.preventDefault();
      show(i + 1);
    }
    if (e.key === "ArrowLeft" || e.key === "PageUp") {
      e.preventDefault();
      show(i - 1);
    }
    if (e.key === "Home") {
      e.preventDefault();
      show(0);
    }
    if (e.key === "End") {
      e.preventDefault();
      show(slides.length - 1);
    }
    if (e.key === "n" || e.key === "N") {
      document.body.classList.toggle("show-notes");
    }
  });

  if (location.search.indexOf("presenter=1") !== -1) {
    document.body.classList.add("presenter-boot", "show-notes");
  }

  var initial = 0;
  var slideParam = location.search.match(/[?&]slide=(\d+)/);
  if (slideParam) {
    var num = parseInt(slideParam[1], 10);
    if (!isNaN(num)) initial = Math.max(0, Math.min(num - 1, slides.length - 1));
  }
  show(initial);
})();

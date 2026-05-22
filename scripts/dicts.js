/* BASTION DICTS v164 — corrected rotating carousel + working sitemap dots */
(() => {
  const folders = [...document.querySelectorAll(".dict-folder")];
  const left = document.querySelector(".dicts-arrow--left");
  const right = document.querySelector(".dicts-arrow--right");

  function normalizeCountText(folder) {
    const count = folder.querySelector(".dict-folder__count");
    if (!count || count.dataset.normalized === "1") return;

    const digits = (count.textContent || "").match(/\d+/)?.[0];
    if (digits) count.textContent = `${digits} записи`;
    count.dataset.normalized = "1";
  }

  function circularDistance(index, center, length) {
    let distance = index - center;
    if (distance > length / 2) distance -= length;
    if (distance < -length / 2) distance += length;
    return distance;
  }

  function initDictsCarousel() {
    if (!folders.length) return;

    let active = folders.findIndex((el) => el.classList.contains("dict-folder--active"));
    if (active < 0) active = Math.min(1, folders.length - 1);

    function render() {
      folders.forEach((folder, index) => {
        normalizeCountText(folder);
        folder.classList.remove("dict-folder--side", "dict-folder--mid", "dict-folder--active");

        const distance = circularDistance(index, active, folders.length);
        const absDistance = Math.abs(distance);

        if (distance === 0) {
          folder.dataset.slot = "0";
          folder.classList.add("dict-folder--active");
        } else if (absDistance === 1) {
          folder.dataset.slot = String(distance);
          folder.classList.add("dict-folder--mid");
        } else if (absDistance === 2) {
          folder.dataset.slot = String(distance);
          folder.classList.add("dict-folder--side");
        } else {
          folder.dataset.slot = "hidden";
        }
      });
    }

    function rotate(direction) {
      active = (active + direction + folders.length) % folders.length;
      render();
    }

    folders.forEach((folder, index) => {
      folder.addEventListener("click", () => {
        active = index;
        render();
      });
    });

    left?.addEventListener("click", () => rotate(-1));
    right?.addEventListener("click", () => rotate(1));

    document.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft") rotate(-1);
      if (event.key === "ArrowRight") rotate(1);
    });

    render();
  }

  function initSitemapDots() {
    const pageMap = {
      core: "./app.html",
      dicts: "./dicts.html",
      nodes: "./nodes.html",
      upload: "./upload.html",
      calculator: "./calculator.html",
      analysis: "./analysis.html",
      command: "./command.html"
    };

    document.querySelectorAll(".map-dot").forEach((dot) => {
      dot.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();

        const target = dot.dataset.target;
        document.querySelectorAll(".map-dot").forEach((item) => {
          item.classList.toggle("is-active", item === dot);
        });

        const href = pageMap[target];
        if (href) window.location.href = href;
      });
    });
  }

  initDictsCarousel();
  initSitemapDots();
})();

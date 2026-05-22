/* BASTION DICTS v157 — real rotating carousel */
(() => {
  const all = [...document.querySelectorAll(".dict-folder")];
  const folders = all.slice(0, 5);
  all.slice(5).forEach((el) => {
    el.dataset.slot = "hidden";
    el.style.display = "none";
  });

  const left = document.querySelector(".dicts-arrow--left");
  const right = document.querySelector(".dicts-arrow--right");

  if (!folders.length) return;

  let active = folders.findIndex((el) => el.classList.contains("dict-folder--active"));
  if (active < 0) active = Math.floor(folders.length / 2);

  function normalizeCountText(folder) {
    const count = folder.querySelector(".dict-folder__count");
    if (!count || count.dataset.normalized === "1") return;
    const digits = (count.textContent || "").match(/\d+/)?.[0] || count.textContent.trim();
    count.textContent = digits;
    count.dataset.normalized = "1";
  }

  function circularDistance(index, center, length) {
    let distance = index - center;
    if (distance > length / 2) distance -= length;
    if (distance < -length / 2) distance += length;
    return distance;
  }

  function render() {
    folders.forEach((folder, index) => {
      normalizeCountText(folder);

      folder.classList.remove("dict-folder--mini", "dict-folder--side", "dict-folder--mid", "dict-folder--active");

      const distance = circularDistance(index, active, folders.length);
      folder.dataset.slot = String(distance);

      if (distance === 0) folder.classList.add("dict-folder--active");
      else if (Math.abs(distance) === 1) folder.classList.add("dict-folder--mid");
      else if (Math.abs(distance) === 2) folder.classList.add("dict-folder--side");
      else {
        folder.classList.add("dict-folder--mini");
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
})();

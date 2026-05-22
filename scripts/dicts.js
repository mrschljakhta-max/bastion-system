/* BASTION DICTS PATCH v154 */
(() => {
  const allFolders = [...document.querySelectorAll(".dict-folder")];
  const folders = allFolders.slice(0, 5);
  allFolders.slice(5).forEach((el) => (el.style.display = "none"));

  const left = document.querySelector(".dicts-arrow--left");
  const right = document.querySelector(".dicts-arrow--right");
  if (!folders.length) return;

  let active = folders.findIndex((el) => el.classList.contains("dict-folder--active"));
  if (active < 0) active = Math.floor(folders.length / 2);

  function render() {
    folders.forEach((folder, index) => {
      folder.classList.remove("dict-folder--mini", "dict-folder--side", "dict-folder--mid", "dict-folder--active");
      const distance = index - active;
      if (distance === 0) folder.classList.add("dict-folder--active");
      else if (Math.abs(distance) === 1) folder.classList.add("dict-folder--mid");
      else folder.classList.add("dict-folder--side");
    });
  }

  folders.forEach((folder, index) => {
    folder.addEventListener("click", () => {
      active = index;
      render();
    });
  });

  left?.addEventListener("click", () => {
    active = (active - 1 + folders.length) % folders.length;
    render();
  });

  right?.addEventListener("click", () => {
    active = (active + 1) % folders.length;
    render();
  });

  render();
})();

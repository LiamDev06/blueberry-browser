(ops) => {
  const positions = {
    prepend: "afterbegin",
    append: "beforeend",
    before: "beforebegin",
    after: "afterend",
  };

  let applied = 0;
  for (const op of ops) {
    const el = document.querySelector(op.selector);
    if (!el) {
      continue;
    }

    if (op.action === "remove") {
      el.remove();
    } else if (op.action === "replace") {
      el.innerHTML = op.html;
    } else if (positions[op.action]) {
      el.insertAdjacentHTML(positions[op.action], op.html);
    } else {
      continue;
    }
    applied += 1;
  }

  return { applied };
}

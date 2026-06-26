const STORAGE_KEY = "bonie-waybill-editor-v2";
const SAVED_KEY = "bonie-waybill-saved-list";

const fieldNodes = [...document.querySelectorAll("[data-field]")];
const printButton = document.getElementById("printButton");
const saveButton = document.getElementById("saveButton");
const clearButton = document.getElementById("clearButton");
const savedList = document.getElementById("savedList");
const saveStatus = document.getElementById("saveStatus");
const printCountInputs = [...document.querySelectorAll('input[name="printCount"]')];
const typeInputs = [...document.querySelectorAll('input[name="type"], input[name="typeMirror"]')];

let state = {
  printCount: "2",
  type: "교환",
  driver: "",
  receivedDate: "",
  customer: "",
  phone: "",
  address: "",
  product: "",
  symptom: "",
  opinion: "",
};

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && typeof saved === "object") state = { ...state, ...saved };
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function blankState(keepPrintCount = true) {
  return {
    printCount: keepPrintCount ? state.printCount : "2",
    type: "교환",
    driver: "",
    receivedDate: "",
    customer: "",
    phone: "",
    address: "",
    product: "",
    symptom: "",
    opinion: "",
  };
}

function readSavedItems() {
  try {
    const items = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function writeSavedItems(items) {
  localStorage.setItem(SAVED_KEY, JSON.stringify(items));
  renderSavedItems();
}

function setSaveStatus(text) {
  saveStatus.textContent = text;
  if (!text) return;
  window.clearTimeout(setSaveStatus.timer);
  setSaveStatus.timer = window.setTimeout(() => {
    saveStatus.textContent = "";
  }, 1800);
}

function getSavedTitle(data) {
  const customer = data.customer || "고객명 없음";
  const product = data.product || "제품명 없음";
  return `${customer} / ${product}`;
}

function renderSavedItems() {
  const items = readSavedItems();
  savedList.innerHTML = "";

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "saved-empty";
    empty.textContent = "저장된 입고송장이 없습니다.";
    savedList.append(empty);
    return;
  }

  items.forEach((item) => {
    const row = document.createElement("div");
    row.className = "saved-item";

    const text = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = getSavedTitle(item.data);
    const meta = document.createElement("small");
    meta.textContent = `${item.data.type || "교환"} · ${item.data.receivedDate || "날짜 없음"}`;
    text.append(title, meta);

    const load = document.createElement("button");
    load.type = "button";
    load.textContent = "불러오기";
    load.addEventListener("click", () => {
      state = { ...blankState(false), ...item.data, printCount: state.printCount };
      saveState();
      render();
      setSaveStatus("불러왔습니다");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "delete-saved";
    remove.textContent = "삭제";
    remove.addEventListener("click", () => {
      writeSavedItems(readSavedItems().filter((saved) => saved.id !== item.id));
      setSaveStatus("삭제했습니다");
    });

    row.append(text, load, remove);
    savedList.append(row);
  });
}

function resizeTextarea(node) {
  if (node.tagName !== "TEXTAREA") return;
  node.style.height = "auto";
  node.style.height = `${node.scrollHeight}px`;
}

function resizeAllTextareas() {
  document.querySelectorAll("textarea").forEach(resizeTextarea);
}

function render() {
  fieldNodes.forEach((node) => {
    node.value = state[node.dataset.field] || "";
    resizeTextarea(node);
  });

  typeInputs.forEach((node) => {
    node.checked = node.value === state.type;
  });

  printCountInputs.forEach((node) => {
    node.checked = node.value === state.printCount;
  });

  document.querySelectorAll("[data-slip]").forEach((node) => {
    node.hidden = state.printCount === "1" && node.dataset.slip === "2";
  });

  document.querySelectorAll("[data-cut-line]").forEach((node) => {
    node.hidden = state.printCount === "1";
  });
}

fieldNodes.forEach((node) => {
  node.addEventListener("input", () => {
    state[node.dataset.field] = node.value;
    fieldNodes
      .filter((other) => other.dataset.field === node.dataset.field && other !== node)
      .forEach((other) => {
        other.value = node.value;
        resizeTextarea(other);
      });
    resizeTextarea(node);
    saveState();
  });
});

typeInputs.forEach((node) => {
  node.addEventListener("change", () => {
    state.type = node.value;
    render();
    saveState();
  });
});

printCountInputs.forEach((node) => {
  node.addEventListener("change", () => {
    state.printCount = node.value;
    render();
    saveState();
  });
});

saveButton.addEventListener("click", () => {
  saveState();
  const items = readSavedItems();
  items.unshift({
    id: Date.now(),
    savedAt: new Date().toISOString(),
    data: { ...state },
  });
  writeSavedItems(items);
  state = blankState();
  saveState();
  render();
  setSaveStatus("저장하고 새 송장을 열었습니다");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

clearButton.addEventListener("click", () => {
  state = blankState();
  saveState();
  render();
});

printButton.addEventListener("click", () => {
  resizeAllTextareas();
  saveState();
  window.print();
});

loadState();
render();
renderSavedItems();
window.addEventListener("beforeprint", resizeAllTextareas);
window.addEventListener("load", resizeAllTextareas);

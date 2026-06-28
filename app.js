const STORAGE_KEY = "bonie-return-waybill-draft-v3";
const SAVED_KEY = "bonie-return-waybill-saved-list-v3";
const SUPABASE_CONFIG_KEY = "bonie-waybill-supabase-config";
const SUPABASE_TABLE = "warehouse_waybills";

const fieldNodes = [...document.querySelectorAll("[data-slip-field]")];
const printButton = document.getElementById("printButton");
const saveButton = document.getElementById("saveButton");
const savedList = document.getElementById("savedList");
const saveStatus = document.getElementById("saveStatus");
const syncStatus = document.getElementById("syncStatus");
const supabaseUrlInput = document.getElementById("supabaseUrl");
const supabaseKeyInput = document.getElementById("supabaseKey");
const connectSupabaseButton = document.getElementById("connectSupabaseButton");
const disconnectSupabaseButton = document.getElementById("disconnectSupabaseButton");
const printCountInputs = [...document.querySelectorAll('input[name="printCount"]')];
const typeInputs = [...document.querySelectorAll("[data-slip-type]")];

function blankSlip() {
  return {
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

let state = {
  printCount: "2",
  slip1: blankSlip(),
  slip2: blankSlip(),
};

function migrateOldState(data) {
  if (data?.slip1 && data?.slip2) {
    return {
      printCount: data.printCount || "2",
      slip1: { ...blankSlip(), ...data.slip1, type: data.slip1.type || data.type || "교환" },
      slip2: { ...blankSlip(), ...data.slip2, type: data.slip2.type || data.type || "교환" },
    };
  }

  const slip = {
    type: data?.type || "교환",
    driver: data?.driver || "",
    receivedDate: data?.receivedDate || "",
    customer: data?.customer || "",
    phone: data?.phone || "",
    address: data?.address || "",
    product: data?.product || "",
    symptom: data?.symptom || "",
    opinion: data?.opinion || "",
  };

  return {
    printCount: data?.printCount || "2",
    slip1: { ...blankSlip(), ...slip },
    slip2: blankSlip(),
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && typeof saved === "object") state = { ...state, ...migrateOldState(saved) };
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
    slip1: blankSlip(),
    slip2: blankSlip(),
  };
}

function getSupabaseConfig() {
  try {
    const config = JSON.parse(localStorage.getItem(SUPABASE_CONFIG_KEY) || "null");
    if (!config?.url || !config?.key) return null;
    return { url: config.url.replace(/\/$/, ""), key: config.key };
  } catch {
    return null;
  }
}

function setSupabaseConfig(config) {
  localStorage.setItem(SUPABASE_CONFIG_KEY, JSON.stringify(config));
}

function clearSupabaseConfig() {
  localStorage.removeItem(SUPABASE_CONFIG_KEY);
}

async function supabaseRequest(path, options = {}) {
  const config = getSupabaseConfig();
  if (!config) throw new Error("Supabase 설정이 없습니다.");

  const response = await fetch(`${config.url}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Supabase 오류 ${response.status}`);
  }

  if (response.status === 204) return null;
  return response.json();
}

function normalizeSavedItem(row) {
  if (row.data) {
    return {
      id: row.id,
      savedAt: row.saved_at || row.savedAt || new Date().toISOString(),
      data: migrateOldState(row.data),
    };
  }
  return { ...row, data: migrateOldState(row.data) };
}

function readLocalSavedItems() {
  try {
    const items = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

function writeLocalSavedItems(items) {
  localStorage.setItem(SAVED_KEY, JSON.stringify(items));
}

async function readSavedItems() {
  if (!getSupabaseConfig()) return readLocalSavedItems();
  const rows = await supabaseRequest(`${SUPABASE_TABLE}?select=id,saved_at,data&order=saved_at.desc`);
  return rows.map(normalizeSavedItem);
}

async function createSavedItem(data) {
  if (!getSupabaseConfig()) {
    const items = readLocalSavedItems();
    items.unshift({ id: Date.now(), savedAt: new Date().toISOString(), data });
    writeLocalSavedItems(items);
    return;
  }

  await supabaseRequest(SUPABASE_TABLE, {
    method: "POST",
    body: JSON.stringify({ data, saved_at: new Date().toISOString() }),
  });
}

async function deleteSavedItem(id) {
  if (!getSupabaseConfig()) {
    writeLocalSavedItems(readLocalSavedItems().filter((saved) => saved.id !== id));
    return;
  }
  await supabaseRequest(`${SUPABASE_TABLE}?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" });
}

function setSaveStatus(text) {
  saveStatus.textContent = text;
  if (!text) return;
  window.clearTimeout(setSaveStatus.timer);
  setSaveStatus.timer = window.setTimeout(() => {
    saveStatus.textContent = "";
  }, 1800);
}

function setSyncStatus(text, isError = false) {
  syncStatus.textContent = text;
  syncStatus.style.color = isError ? "#9f2525" : "#66737b";
}

function getSavedTitle(data) {
  const normalized = migrateOldState(data);
  const firstCustomer = normalized.slip1.customer || normalized.slip2.customer || "고객명 없음";
  const firstProduct = normalized.slip1.product || normalized.slip2.product || "제품명 없음";
  const countText = normalized.printCount === "2" ? "2건" : "1건";
  return `${firstCustomer} / ${firstProduct} (${countText})`;
}

async function renderSavedItems() {
  savedList.innerHTML = "";
  let items = [];

  try {
    items = await readSavedItems();
    setSyncStatus(getSupabaseConfig() ? "Supabase 공유 저장소에 연결되어 있습니다." : "설정 전에는 이 기기에만 저장됩니다.");
  } catch (error) {
    setSyncStatus(`공유 저장소 오류: ${error.message}`, true);
    items = readLocalSavedItems();
  }

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "saved-empty";
    empty.textContent = "저장된 반품송장이 없습니다.";
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
    const normalized = migrateOldState(item.data);
    const date = normalized.slip1.receivedDate || normalized.slip2.receivedDate || "날짜 없음";
    meta.textContent = `${normalized.slip1.type || "교환"} · ${date}`;
    text.append(title, meta);

    const load = document.createElement("button");
    load.type = "button";
    load.textContent = "불러오기";
    load.addEventListener("click", () => {
      state = { ...blankState(false), ...migrateOldState(item.data), printCount: state.printCount };
      saveState();
      render();
      setSaveStatus("불러왔습니다");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "delete-saved";
    remove.textContent = "삭제";
    remove.addEventListener("click", async () => {
      try {
        await deleteSavedItem(item.id);
        await renderSavedItems();
        setSaveStatus("삭제했습니다");
      } catch (error) {
        setSaveStatus("삭제 실패");
        setSyncStatus(`삭제 오류: ${error.message}`, true);
      }
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

function formatDate(value) {
  if (!value) return "";
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) return value;
  return `${year}.${month}.${day}`;
}

function setSlipVisibility() {
  const isOne = state.printCount === "1";
  document.querySelector('[data-slip-editor="slip2"]').hidden = isOne;
  document.querySelector('[data-slip-print="slip2"]').hidden = isOne;
  document.querySelector("[data-cut-line]").hidden = isOne;
}

function renderPrintSheet() {
  document.querySelectorAll("[data-print-value]").forEach((node) => {
    const [slip, field] = node.dataset.printValue.split(".");
    const value = state[slip]?.[field] || "";
    node.textContent = field === "receivedDate" ? formatDate(value) : value;
  });

  document.querySelectorAll("[data-type-box]").forEach((node) => {
    const [slip, type] = node.dataset.typeBox.split(".");
    node.classList.toggle("checked", state[slip]?.type === type);
  });
}

function render() {
  fieldNodes.forEach((node) => {
    const [slip, field] = node.dataset.slipField.split(".");
    node.value = state[slip]?.[field] || "";
    resizeTextarea(node);
  });

  typeInputs.forEach((node) => {
    const slip = node.dataset.slipType;
    node.checked = state[slip]?.type === node.value;
  });

  printCountInputs.forEach((node) => {
    node.checked = node.value === state.printCount;
  });

  setSlipVisibility();
  renderPrintSheet();
}

function renderSupabaseConfig() {
  const config = getSupabaseConfig();
  supabaseUrlInput.value = config?.url || "";
  supabaseKeyInput.value = config?.key || "";
  setSyncStatus(config ? "Supabase 공유 저장소에 연결되어 있습니다." : "설정 전에는 이 기기에만 저장됩니다.");
}

fieldNodes.forEach((node) => {
  node.addEventListener("input", () => {
    const [slip, field] = node.dataset.slipField.split(".");
    state[slip][field] = node.value;
    resizeTextarea(node);
    renderPrintSheet();
    saveState();
  });
});

typeInputs.forEach((node) => {
  node.addEventListener("change", () => {
    state[node.dataset.slipType].type = node.value;
    renderPrintSheet();
    saveState();
  });
});

printCountInputs.forEach((node) => {
  node.addEventListener("change", () => {
    state.printCount = node.value;
    setSlipVisibility();
    saveState();
  });
});

connectSupabaseButton.addEventListener("click", async () => {
  const url = supabaseUrlInput.value.trim();
  const key = supabaseKeyInput.value.trim();
  if (!url || !key) {
    setSyncStatus("Supabase URL과 anon key를 모두 입력해 주세요.", true);
    return;
  }

  setSupabaseConfig({ url, key });
  try {
    await renderSavedItems();
    setSaveStatus("공유 저장 연결 완료");
  } catch (error) {
    setSyncStatus(`연결 오류: ${error.message}`, true);
  }
});

disconnectSupabaseButton.addEventListener("click", async () => {
  clearSupabaseConfig();
  renderSupabaseConfig();
  await renderSavedItems();
  setSaveStatus("공유 저장 연결 해제");
});

saveButton.addEventListener("click", async () => {
  saveState();
  try {
    await createSavedItem({ ...state });
    state = blankState();
    saveState();
    render();
    setSaveStatus("저장하고 새 반품송장을 열었습니다");
    window.scrollTo({ top: 0, behavior: "smooth" });
    await renderSavedItems();
  } catch (error) {
    setSaveStatus("저장 실패");
    setSyncStatus(`저장 오류: ${error.message}`, true);
  }
});

printButton.addEventListener("click", () => {
  resizeAllTextareas();
  renderPrintSheet();
  saveState();
  window.print();
});

loadState();
renderSupabaseConfig();
render();
renderSavedItems();
window.addEventListener("beforeprint", renderPrintSheet);
window.addEventListener("load", resizeAllTextareas);

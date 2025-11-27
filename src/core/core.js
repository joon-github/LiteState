const repeatCache = new Map();
const componentMap = new Map();
const pendingUpdates = new Map();
const pendingEffects = new Map();
const templateCache = new Map();
const styleCache = new Map();

let isScheduled = false;
let isScheduledEffects = false;

function extractViteCss(raw) {
  if (!raw) return "";

  // Vite가 만든 모듈이 아니면 그대로 CSS라고 보고 리턴
  const marker = "const __vite__css =";
  const start = raw.indexOf(marker);
  if (start === -1) {
    return raw;
  }

  let i = start + marker.length;

  // 공백 스킵
  while (i < raw.length && /\s/.test(raw[i])) i++;

  // 문자열 시작 따옴표(" 또는 ')
  const quote = raw[i];
  if (quote !== '"' && quote !== "'") {
    return raw;
  }
  i++;

  let css = "";
  let escaped = false;

  // 따옴표 닫힐 때까지 JS 문자열 리터럴 직접 파싱
  for (; i < raw.length; i++) {
    const ch = raw[i];

    if (escaped) {
      // 최소한의 escape 처리 (\n, \t 정도만)
      if (ch === "n") css += "\n";
      else if (ch === "t") css += "\t";
      else css += ch;
      escaped = false;
    } else if (ch === "\\") {
      escaped = true;
    } else if (ch === quote) {
      // 문자열 끝
      break;
    } else {
      css += ch;
    }
  }

  return css;
}


function normalizeUrl(url) {
  if (!url) return "";
  if (typeof url === "string") return url;
  if (url instanceof URL) return url.href;
  if (typeof url === "object" && url.href) return url.href;
  return String(url);
}

function loadTextCached(url, cache) {
  const key = normalizeUrl(url);
  if (!key) return Promise.resolve("");
  if (cache.has(key)) return cache.get(key);
  const p = fetch(key).then((res) => {
    if (!res.ok) {
      throw new Error(`Failed to load ${key}: ${res.status}`);
    }
    return res.text();
  });
  cache.set(key, p);
  return p;
}

function getRepeatContext(root, key) {
  let rootMap = repeatCache.get(root);
  if (!rootMap) {
    rootMap = new Map();
    repeatCache.set(root, rootMap);
  }

  let ctx = rootMap.get(key);
  if (!ctx) {
    const template = root.querySelector(`[data-repeat="${key}"]`);
    if (!template || !template.parentNode) return null;

    const parent = template.parentNode;
    const items = new Map();

    parent.querySelectorAll(`[data-repeat-item="${key}"]`).forEach((node) => {
      const id = node.dataset.id;
      if (id != null) items.set(id, node);
    });

    ctx = { template, parent, items };
    rootMap.set(key, ctx);
  }

  // 템플릿 초기화
  if (!ctx.template.dataset.repeatTemplate) {
    ctx.template.dataset.repeatTemplate = "true";
    ctx.template.style.display = "none";
  }

  return ctx;
}

function applyListOp(root, key, action) {
  const ctx = getRepeatContext(root, key);
  if (!ctx) return;

  const { template, parent, items } = ctx;

  switch (action.type) {
    case "update": {
      const record = root.__record || componentMap.get(root);
      const states =
        record && record.db && record.db.has(key)
          ? record.db.get(key).value
          : null;
      if (!Array.isArray(states)) break;

      const updates = Array.isArray(action.updatedItems)
        ? action.updatedItems
        : [];
      if (!updates.length) break; // 변경된 항목이 없으면 DOM 업데이트 스킵

      updates.forEach(({ id, patchFields, data }) => {
        if (id == null) return;
        const itemId = String(id);
        const itemNode = items.get(itemId);
        if (!itemNode) return;
        if (!data) return;

        const fields =
          Array.isArray(patchFields) && patchFields.length
            ? patchFields
            : Object.keys(data);
        fields.forEach((field) => {
          const target = itemNode.querySelector(
            `[data-repeat-field="${field}"]`
          );
          if (target) {
            target.textContent = data[field];
          }
        });
      });
      break;
    }

    case "add": {
      const item = action.item;
      if (!item) return;

      const newNode = template.cloneNode(true);
      newNode.removeAttribute("data-repeat");
      newNode.removeAttribute("data-repeat-template");
      newNode.style.display = "";
      newNode.setAttribute("data-repeat-item", key);
      newNode.dataset.id = String(item.id);

      Object.keys(item).forEach((field) => {
        const target = newNode.querySelector(`[data-repeat-field="${field}"]`);
        if (target) {
          target.textContent = item[field];
        }
      });

      parent.appendChild(newNode);
      items.set(String(item.id), newNode);
      break;
    }

    case "remove": {
      const ids = Array.isArray(action.deletedIds)
        ? action.deletedIds
        : action.id != null
          ? [action.id]
          : [];
      if (!ids.length) break;
      ids.forEach((rawId) => {
        const id = String(rawId);
        const itemNode = items.get(id);
        if (itemNode) {
          itemNode.remove();
          items.delete(id);
        }
      });
      break;
    }

    default:
      // 알 수 없는 액션이면 아무것도 안 함
      break;
  }
}

function flushUpdates() {
  pendingUpdates.forEach((stateMap, root) => {
    stateMap.forEach((value, key) => {
      // 1) 리스트 액션이면 부분 업데이트만
      if (value && typeof value === "object" && value.__op === "list") {
        applyListOp(root, key, value);
        return;
      }

      // 2) 일반 data-state 텍스트 업데이트
      const nodes = root.querySelectorAll(`[data-state="${key}"]`);
      nodes.forEach((node) => {
        node.textContent = value;
      });

      // 3) 조건부 렌더링(data-condition)
      const conditionNodes = root.querySelectorAll(`[data-condition="${key}"]`);
      if (conditionNodes.length) {
        const valueString = String(value);
        conditionNodes.forEach((container) => {
          container.querySelectorAll("[data-condition-case]").forEach((el) => {
            const match = el.dataset.conditionCase === valueString;
            el.style.display = match ? "" : "none";
          });
        });
      }

      // 4) 배열일 때만 전체 리스트 렌더 (초기 렌더 등)
      const template = root.querySelector(`[data-repeat="${key}"]`);
      if (!template) return;

      const parentNode = template.parentNode;
      if (!parentNode) return;

      const states = stateMap.get(key);
      if (!Array.isArray(states)) return;

      // 캐시 컨텍스트 가져오기
      const ctx = getRepeatContext(root, key);
      if (!ctx) return;
      const { items } = ctx;

      // 템플릿 초기화는 getRepeatContext에서 처리됨

      const renderedNodes = Array.from(
        parentNode.querySelectorAll(`[data-repeat-item="${key}"]`)
      );
      const nodeMap = new Map();
      renderedNodes.forEach((node) => {
        const id = node.dataset.id;
        if (id != null) {
          nodeMap.set(id, node);
        }
      });

      // 기존 캐시는 지우고 새로 채울 것
      items.clear();

      let anchor = template;
      states.forEach((state) => {
        const id = String(state.id);
        let itemNode = nodeMap.get(id);

        if (!itemNode) {
          itemNode = template.cloneNode(true);
          itemNode.removeAttribute("data-repeat");
          itemNode.removeAttribute("data-repeat-template");
          itemNode.style.display = "";
          itemNode.setAttribute("data-repeat-item", key);
          itemNode.dataset.id = id;
        }

        const nextNode = anchor.nextSibling;
        if (nextNode !== itemNode) {
          parentNode.insertBefore(itemNode, nextNode);
        }
        anchor = itemNode;

        Object.keys(state).forEach((stateKey) => {
          const target = itemNode.querySelector(
            `[data-repeat-field="${stateKey}"]`
          );
          if (target) {
            target.textContent = state[stateKey];
          }
        });

        // 새 캐시에 등록
        items.set(id, itemNode);
        nodeMap.delete(id);
      });

      nodeMap.forEach((node, id) => {
        node.remove();
        items.delete(id);
      });
    });
    const childrenComponent = root.querySelectorAll(`[data-root]`);
    childrenComponent.forEach((child) => {
      // 자식컴포넌트에 부모 uniqueId를 넣어준다.
      child.dataset.parent = root.uniqueId;
    });
  });

  pendingUpdates.clear();
  isScheduled = false;
}

function queueDomUpdate(root, key, value) {
  let map = pendingUpdates.get(root);
  if (!map) {
    map = new Map();
    pendingUpdates.set(root, map);
  }
  map.set(key, value);

  if (!isScheduled) {
    isScheduled = true;
    requestAnimationFrame(flushUpdates);
  }
}

function bindEvents(root) {
  requestAnimationFrame(() => {
    const onMethods = Object.keys(root).filter((key) => key.startsWith("on"));
    const bindedMethods = {};
    onMethods.forEach((methodName) => {
      if (typeof root[methodName] === "function") {
        bindedMethods[methodName] = root[methodName];
      }
    });
    const handlers = bindedMethods;
    root.querySelectorAll("[data-on]").forEach((el) => {
      const [type, name] = el.dataset.on.split(":");
      const fn = handlers[name];
      if (type && fn) el.addEventListener(type, fn);
    });
  });
}

function flushEffects() {
  pendingEffects.forEach((stateMap, record) => {
    stateMap.forEach(({ value, force }, key) => {
      const effects = record.useEffectMap.get(key);
      if (!effects) return;

      effects.forEach((effect) => {
        const shouldRun = force || effect.lastValue !== value;
        if (!shouldRun) return;
        effect.lastValue = value;
        effect.callback(value);
      });
    });
  });
  pendingEffects.clear();
  isScheduledEffects = false;
}

function queueEffects(record, key, value, { forceInitial = false } = {}) {
  let map = pendingEffects.get(record);
  if (!map) {
    map = new Map();
    pendingEffects.set(record, map);
  }

  const existing = map.get(key);
  const force = forceInitial || (existing ? existing.force : false);
  map.set(key, { value, force });

  if (!isScheduledEffects) {
    isScheduledEffects = true;
    requestAnimationFrame(flushEffects);
  }
}

function registerComponent(root) {
  const record = {
    useEffectMap: new Map(),
    db: new Map(),
    roots: new Set([root]),
    uniqueId: root.nodeName + "-" + Math.random().toString(36).substring(2, 15),
  };

  componentMap.set(record.uniqueId, record);
  root.__record = record;

  function getRecord() {
    return root.__record || record;
  }

  function useState(stateKey, initialValue) {
    const { db, roots } = getRecord();

    // 최초 초기화
    if (!db.has(stateKey)) {
      const state = { value: initialValue };
      const proxy = new Proxy(state, {
        get(target, key) {
          return target[key];
        },
        set(target, key, value) {
          target[key] = value;
          return true;
        },
      });
      db.set(stateKey, proxy);

      roots.forEach((node) => queueDomUpdate(node, stateKey, initialValue));
    }

    function getState() {
      const { db: currentDb } = getRecord();
      return currentDb.get(stateKey).value;
    }

    function setState(next) {
      const {
        db: currentDb,
        useEffectMap: currentEffects,
        roots: currentRoots,
      } = getRecord();

      const prevValue = currentDb.get(stateKey).value;
      let nextValue = prevValue;
      let domValue = undefined; // DOM 쪽으로 넘길 값

      // 1) 함수형 업데이트: setState(prev => ...)
      if (typeof next === "function") {
        const draft = next(prevValue);

        // 1-1) 액션 객체 (리스트 전용)
        if (
          draft &&
          typeof draft === "object" &&
          typeof draft.type === "string"
        ) {
          // DB용 전체 배열 계산
          switch (draft.type) {
            case "update": {
              const { id, patch, condition } = draft;
              if (!Array.isArray(prevValue)) {
                nextValue = prevValue;
                break;
              }
              const updatedItems = [];
              const shouldUpdate =
                typeof condition === "function"
                  ? condition
                  : (item) => (id == null ? false : item.id === id);
              const getPatch =
                typeof patch === "function" ? patch : () => patch || {};
              nextValue = prevValue.map((item) => {
                if (!shouldUpdate(item)) return item;
                const changes = getPatch(item) || {};
                const merged = { ...item, ...changes };
                const patchFields = Object.keys(merged).filter(
                  (field) => item[field] !== merged[field]
                );
                if (patchFields.length) {
                  updatedItems.push({ id: item.id, patchFields, data: merged });
                }
                return merged;
              });
              draft.updatedItems = updatedItems;
              break;
            }
            case "add": {
              const { item } = draft;
              nextValue = Array.isArray(prevValue)
                ? [...prevValue, item]
                : prevValue;
              break;
            }
            case "remove": {
              const { condition } = draft;
              const removeIds = [];
              nextValue = Array.isArray(prevValue)
                ? prevValue.filter((item) => {
                    if (condition(item)) {
                      removeIds.push(item.id);
                      return false;
                    }
                    return true;
                  })
                : prevValue;
              draft.deletedIds = removeIds;
              break;
            }
            default: {
              nextValue = prevValue;
            }
          }
          // DOM용 값은 "액션" 정보만 넘김
          domValue = { __op: "list", ...draft };
        } else {
          // 1-2) 일반 함수형 업데이트: draft 그대로 새 값
          nextValue = draft;
          domValue = nextValue;
        }
      } else {
        // 2) setState(값)
        nextValue = next;
        domValue = nextValue;
      }

      // 실제 state 저장
      currentDb.get(stateKey).value = nextValue;

      // DOM 업데이트 enqueue
      currentRoots.forEach((node) => queueDomUpdate(node, stateKey, domValue));

      // useEffect 트리거는 전체 값 기준
      if (currentEffects.has(stateKey)) {
        queueEffects(getRecord(), stateKey, nextValue);
      }
    }

    root[`get${stateKey.charAt(0).toUpperCase() + stateKey.slice(1)}`] =
      getState;
    root[`set${stateKey.charAt(0).toUpperCase() + stateKey.slice(1)}`] =
      setState;
  }

  function useEffect(callback, keys) {
    const { db, useEffectMap } = getRecord();
    keys.forEach((key) => {
      const list = useEffectMap.get(key) || [];
      list.push({ callback, lastValue: undefined });
      useEffectMap.set(key, list);
      const currentValue = db.has(key) ? db.get(key).value : undefined;
      queueEffects(getRecord(), key, currentValue, { forceInitial: true });
    });
  }
  root.db = record.db;
  root.uniqueId = record.uniqueId;
  root.useState = useState;
  root.useEffect = useEffect;
}

export function getStateComponent(idOrRoot) {
  return componentMap.get(idOrRoot);
}

export function connectDB(root, targetId) {
  const target = componentMap.get(targetId);
  const current = componentMap.get(root);
  if (!target) return;

  if (current && current.roots) {
    current.roots.delete(root);
  }

  target.roots.add(root);
  componentMap.set(root, target);
  root.__record = target;
  root.db = target.db;
  root.uniqueId = target.uniqueId;

  // 새로 연결된 루트에도 현재 상태 값을 즉시 반영한다.
  target.db.forEach((state, key) => {
    queueDomUpdate(root, key, state.value);
  });
}

// core.js
export class BaseComponent extends HTMLElement {
  constructor() {
    super();

    const ctor = this.constructor;
    if (ctor.moduleUrl) {
      this.path = ctor.moduleUrl;
      this.baseDir = this.path.split("/").slice(0, -1).join("/");
    }

    registerComponent(this);
    this.render();
  }

  static withModule(url) {
    const Base = this;
    return class extends Base {
      static moduleUrl = url;
    };
  }

  render() {
    const ctor = this.constructor;
    const baseDir =
      this.baseDir || (this.path ? this.path.split("/").slice(0, -1).join("/") : "");
    const baseName = this.localName
      .split("-")[0]
      .replace(/^./, (c) => c.toUpperCase());

    const templateUrl =
      ctor.templateUrl ||
      (baseDir ? `${baseDir}/${baseName}.html` : `${baseName}.html`);
    const styleUrl =
      ctor.styleUrl || (baseDir ? `${baseDir}/${baseName}.css` : `${baseName}.css`);

    const templatePromise = loadTextCached(templateUrl, templateCache);
    const stylePromise = styleUrl
      ? loadTextCached(styleUrl, styleCache).catch(() => "")
      : Promise.resolve("");

    Promise.all([templatePromise, stylePromise])
      .then(([template, cssRaw]) => {
        const css = extractViteCss(cssRaw);
        if (typeof this.setup === "function") {
          this.setup({ useState: this.useState });
        }

        if (this.dataset.root !== undefined) {
          requestAnimationFrame(() => {
            const parentId = this.dataset.parent || this.dataset.root;
            if (parentId && getStateComponent(parentId)) {
              connectDB(this, parentId);
            }
          });
        }

        this.innerHTML = (css ? `<style>${css}</style>` : "") + template;

        if (typeof this.bindEvents === "function") {
          this.bindEvents(this);
        }
        bindEvents(this);
      })
      .catch((err) => {
        console.error(`[${this.localName}] render failed:`, err);
      });
  }

  connectedCallback() {}
}

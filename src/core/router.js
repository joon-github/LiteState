// #/play/count?foo=bar → "/play/count" 이렇게 정규화.
function normalizeRoute(hashOrPath = "") {
  const raw = String(hashOrPath || "").replace(/^#/, "");
  const path = raw.startsWith("/") ? raw : raw ? `/${raw}` : "/";
  return path.split("?")[0] || "/";
}

// routes 배열에 없는 경로면 부모들을 위로 타고 올라가며 가장 가까운 걸 찾음.
// 예: /play/count/123 + ["/","/play","/play/count"] → /play/count
function matchRoute(path, routes) {
  const set = new Set(routes);
  if (set.has(path)) return path;

  const segments = path.split("/").filter(Boolean);
  while (segments.length) {
    const candidate = `/${segments.join("/")}`;
    if (set.has(candidate)) return candidate;
    segments.pop();
  }
  return "notfound";
}

// /play/count → ["/play", "/play/count"]
// Next.js layout 스택 개념 만들기.
function buildRouteStack(path) {
  if (path === "notfound") return ["notfound"];
  const parts = path.split("/").filter(Boolean);
  const stack = [];
  for (let i = 0; i < parts.length; i++) {
    stack.push("/" + parts.slice(0, i + 1).join("/"));
  }
  return stack.length ? stack : ["/"];
}

// data-route-shared 속성을 가진 요소들을 렌더링 스택에 따라 표시/숨기기.
function applySharedViews(root, stack) {
  if (!root) return;
  const sharedBlocks = root.querySelectorAll("[data-route-shared]");
  sharedBlocks.forEach((block) => {
    const target = block.dataset.routeShared;
    block.style.display = target && stack.includes(target) ? "" : "none";
  });
}

export function createHashRouter({
  routes = [],
  root = null,
  onChange,
  containerSelector = "[data-router-container]",
} = {}) {
  const routesList = Array.from(routes);
  const container =
    root?.querySelector(containerSelector) || root || document.body;

  const layoutTemplates = new Map();
  const viewTemplates = new Map();

  const layoutNodes = container.querySelectorAll("[data-route-layout]");
  layoutNodes.forEach((node) => {
    // 먼저 내부 뷰를 추출해서 별도 템플릿으로 저장
    node.querySelectorAll("[data-route-view]").forEach((view) => {
      viewTemplates.set(view.dataset.routeView, view.cloneNode(true));
      view.remove();
    });
    const cleanLayout = node.cloneNode(true);
    // 레이아웃 템플릿은 뷰 없이 슬롯만 남도록 보관
    cleanLayout
      .querySelectorAll("[data-route-view]")
      .forEach((v) => v.remove());
    layoutTemplates.set(node.dataset.routeLayout, cleanLayout);
    node.remove();
  });

  const viewNodes = container.querySelectorAll("[data-route-view]");
  viewNodes.forEach((node) => {
    viewTemplates.set(node.dataset.routeView, node.cloneNode(true));
    node.remove();
  });

  let current = matchRoute(normalizeRoute(location.hash), routesList);
  let currentStack = buildRouteStack(current);
  let started = false;

  function renderStack(stack) {
    while (container.firstChild) container.removeChild(container.firstChild);
    let parent = container;

    stack.forEach((path, idx) => {
      const isLast = idx === stack.length - 1;
      const layout = layoutTemplates.get(path);
      if (layout) {
        const layoutNode = layout.cloneNode(true);
        parent.appendChild(layoutNode);
        parent = layoutNode.querySelector("[data-route-slot]") || layoutNode;
      }

      if (isLast) {
        const view =
          viewTemplates.get(path) ||
          viewTemplates.get("notfound") ||
          viewTemplates.get("/notfound") ||
          document.createElement("div");
        parent.appendChild(view.cloneNode(true));
      }
    });
  }

  function emit(nextPath) {
    current = matchRoute(nextPath, routesList);
    currentStack = buildRouteStack(current);
    renderStack(currentStack);
    applySharedViews(root, currentStack);
    onChange?.({ route: current, stack: currentStack, raw: nextPath });
    return { route: current, stack: currentStack };
  }

  const handleHashChange = () => {
    emit(normalizeRoute(location.hash));
  };

  function start() {
    if (started) return { route: current, stack: currentStack };
    started = true;
    const initial = emit(normalizeRoute(location.hash));
    window.addEventListener("hashchange", handleHashChange);
    return initial;
  }

  function navigate(path) {
    const normalized = normalizeRoute(path);
    if (normalized !== location.hash.replace(/^#/, "")) {
      window.location.hash = normalized;
    }
    return emit(normalized);
  }

  function dispose() {
    if (!started) return;
    window.removeEventListener("hashchange", handleHashChange);
    started = false;
  }

  return {
    get route() {
      return current;
    },
    get stack() {
      return currentStack;
    },
    normalizeRoute,
    matchRoute: (p) => matchRoute(p, routesList),
    buildRouteStack,
    start,
    navigate,
    dispose,
  };
}

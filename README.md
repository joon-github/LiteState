> 가벼운 React 느낌의 **상태 관리 + 템플릿 렌더링 + 해시 기반 라우터**를  
> Web Components 위에 얹은 작은 프레임워크입니다.

`lite_react`는 아래 세 가지를 중심으로 동작합니다.

- `BaseComponent` – Web Component + 상태 관리 + 템플릿 로딩
- `useState` / `useEffect` 스타일 API
- `createHashRouter` – `#/path` 기반 라우터 + 중첩 레이아웃

---

## ✨ 특징

- **Web Components 기반**: `customElements` 위에서 동작해, 프레임워크 의존성이 적습니다.
- **간단한 상태 관리**: `useState` / `useEffect` 스타일 API로 최소한의 러닝 커브.
- **HTML 친화적 바인딩**: `data-state`, `data-repeat`, `data-condition` 등 속성으로 DOM을 갱신합니다.
- **해시 라우팅**: `#/about`, `#/play/count` 같은 경로를 라우트 상태로 사용.
- **CDN / npm 모두 지원**: 번들러 없이도 `<script>` 하나로 실험해 볼 수 있습니다.

---

## 🚀 설치 & 프로젝트 생성

CLI 템플릿으로 새 프로젝트를 빠르게 만들 수 있습니다.

```bash
npx @bj.pyeon/create-lite-state-app my-app
cd my-app
npm install
npm run dev
```

- `npx @bj.pyeon/create-lite-state-app my-app`  
  - 템플릿 프로젝트가 `my-app` 폴더에 생성됩니다.
- `npm run dev`  
  - Vite 개발 서버가 뜨고 브라우저에서 데모를 확인할 수 있습니다.

---

## 📁 프로젝트 구조

생성된 템플릿의 대략적인 구조는 다음과 같습니다.

```bash
template/
  index.html
  src/
    core/
      core.js        # 상태 관리 + BaseComponent 정의
      router.js      # 해시 기반 라우터
    components/
      Count.js       # 예시 컴포넌트
      Count.html
      Count.css
    App.html         # 라우터 데모용 앱 셸
    App.css
    index.js         # 엔트리 포인트 (router 초기화 등)
  vite.config.mjs
  package.json
```

---

## 🧩 BaseComponent & 상태 관리

이 프레임워크의 핵심은 `BaseComponent`를 상속한 Web Component입니다.

### 1) 컴포넌트 기본 형태

```js
// src/components/Count.js
import { BaseComponent } from "../core/core.js";

class CountComponent extends BaseComponent.withModule(import.meta.url) {
  constructor() {
    super();
  }

  setup({ useState }) {
    useState("count", 5);
    useState("status", "Pending");
    useState(
      "users",
      Array.from({ length: 3 }, (_, i) => ({
        id: i + 1,
        name: `User${i + 1}`,
        age: 20 + (i % 30),
        email: `User`,
      }))
    );
  }

  bindEvents({ getCount, setCount, getUsers, setUsers, getStatus, setStatus }) {
    this.onIncrement = () => {
      setCount(getCount() + 1);
    };
    // ...
  }
}

customElements.define("count-component", CountComponent);
```

- `BaseComponent.withModule(import.meta.url)`  
  - 현재 모듈의 경로를 이용해 동일 경로의 HTML/CSS 템플릿을 자동 로딩합니다.  
  (예: `Count.js` - `Count.html`, `Count.css`)
- `setup({ useState })`  
  - 컴포넌트 상태를 선언하는 곳입니다.
- `bindEvents({...})`  
  - 상태에 대응되는 getter/setter(`getCount`, `setCount`, `getUsers`, `setUsers` 등)가 인자로 주입되며, 여기서 DOM 이벤트 핸들러를 정의합니다.

---

## 🎨 템플릿 바인딩 규칙

`core.js`는 특정 HTML `data-*` 속성을 기준으로 자동으로 DOM을 갱신합니다.

### 1) 단일 값 상태 – `data-state`

```html
<p>
  현재 경로: <span data-state="route"></span>
</p>
```

```js
useState("route", "/");
setRoute("/about"); // data-state="route"가 "/about"으로 갱신
```

### 2) 조건부 렌더링 – `data-condition` / `data-condition-case`

```html
<div data-condition="status">
  <p data-condition-case="Pending">대기 중...</p>
  <p data-condition-case="Error">에러!</p>
  <p data-condition-case="true">성공!</p>
</div>
```

```js
useState("status", "Pending");
setStatus("Error"); // - "에러!"만 보이도록 처리
```

- `flushUpdates`에서 `data-condition` 컨테이너의 자식 중  
  `data-condition-case`를 비교해 `display`를 토글합니다.

### 3) 리스트 렌더링 – `data-repeat` / `data-repeat-item` / `data-repeat-field`

```html
<!-- Count.html 일부 예시 -- <li data-repeat="users">
  <span data-repeat-field="id"></span>.
  <span data-repeat-field="name"></span>
  (<span data-repeat-field="age"></span>)
</li>
```

```js
useState("users", [
  { id: 1, name: "User1", age: 20 },
  { id: 2, name: "User2", age: 21 },
]);

// 추가
setUsers(() => ({
  type: "add",
  item: { id: 3, name: "User3", age: 22 },
}));

// 삭제
setUsers(() => ({
  type: "remove",
  condition: (user) => user.id > 10,
}));

// 업데이트
setUsers(() => ({
  type: "update",
  condition: (user) => user.id > 10,
  patch: (user) => ({
    ...user,
    age: Math.floor(Math.random() * 100),
    email: "User@example.com",
  }),
}));
```

- `data-repeat="users"` 를 가진 노드는 템플릿 역할을 하며,  
  첫 렌더에서 숨겨진 뒤 리스트 항목으로 복제됩니다.
- `setUsers`에 액션 객체(`{ type: "add" | "remove" | "update", ... }`)를 넘기면,  
  내부에서 diff를 계산하고 필요한 항목만 부분 업데이트합니다.

---

## 🧭 해시 라우터 사용법

라우터는 주소창의 `#` 뒤 경로를 기반으로 동작하며, 다음 개념을 사용합니다.

- `routes`: 허용되는 경로 배열 (예: `["/","/about","/play","/play/count"]`)
- `data-route-view`: 특정 경로에 대응하는 뷰
- `data-route-layout`: 특정 경로의 레이아웃, 하위 경로에 대해 유지
- `data-route-slot`: 레이아웃 안에 하위 뷰가 들어갈 슬롯

### 1) App 템플릿 예시

`src/App.html` 안의 구조는 대략 다음과 같습니다.

```html
<main class="view" data-router-container>
  <section data-route-view="/">
    <h2>홈</h2>
    ...
  </section>

  <section data-route-view="/about">
    <h2>소개</h2>
    ...
  </section>

  <section data-route-layout="/play">
    <h2>플레이 레이아웃</h2>
    <div data-route-slot>
      <section data-route-view="/play">...</section>

      <section data-route-view="/play/count">
        <h2>플레이 / Count</h2>
        <count-component></count-component>
      </section>
    </div>
  </section>

  <section data-route-view="notfound">
    <h2>404</h2>
    ...
  </section>
</main>
```

- `/play` 경로와 그 하위 경로(`/play/count` 등)는 같은 레이아웃을 공유합니다.
- `data-router-container` 안의 템플릿을 `router.js`가 읽어서,  
  현재 경로에 맞게 렌더링합니다.

### 2) 라우터 초기화

엔트리(`src/index.js`)에서 대략 아래와 같이 사용할 수 있습니다.

```js
import { createHashRouter } from "./core/router.js";

const routes = ["/", "/about", "/play", "/play/count"];

const router = createHashRouter({
  routes,
  root: document.querySelector(".app-shell"),
  onChange: ({ route }) => {
    // 예: 상태에 현재 경로를 저장해서 UI에 표시
    const routeSpan = document.querySelector("[data-state='route']");
    if (routeSpan) routeSpan.textContent = route;
  },
});

router.start();
```

- `createHashRouter(...).start()`를 호출하면 현재 `location.hash`를 기준으로  
  첫 렌더를 수행하고, 이후 `hashchange` 이벤트를 구독해 자동으로 뷰를 변경합니다.

---

## 🔁 CountComponent 예제로 보는 전체 흐름

1. 사용자가 `/play/count` 경로로 이동  
  - 해시 라우터가 `/play` 레이아웃 + `/play/count` 뷰를 조합하여 렌더링
2. 뷰 안의 `<count-component>`가 생성됨
3. `CountComponent` 생성자에서 `BaseComponent`가 템플릿(HTML/CSS)을 로드하고  
   `setup` 실행, 상태 초기화
4. `bindEvents`에서 정의한 메서드들이 DOM에 `data-on="click:onIncrement"`  
   형태로 바인딩됨
5. 버튼 클릭 - `setCount`, `setUsers` 등 상태 변경 - 내부 `queueDomUpdate` -  
   `flushUpdates`에서 관련 DOM만 리렌더링 (텍스트, 리스트, 조건부 블록 등)

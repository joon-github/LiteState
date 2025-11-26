# lite_react CDN 사용 가이드

가벼운 커스텀 엘리먼트 / 상태 관리 / 라우터를 제공하는 **lite_react**를
CDN으로 배포하고 사용하는 방법을 정리한 문서입니다.

- 빌드 도구: Vite (library mode)
- 출력 형식:
  - ESM: `dist/lite-react.es.js`
  - UMD: `dist/lite-react.umd.js`

---

## 1. 빌드하기

먼저 라이브러리를 한 번 빌드합니다.

```bash
cd lite_react
npm install
npm run build
```

빌드가 끝나면 `lite_react/dist` 안에 다음 파일들이 생성됩니다.

- `dist/lite-react.es.js` (ESM 번들)
- `dist/lite-react.umd.js` (UMD 번들, 전역 변수 사용 가능)

라이브러리의 공개 엔트리 포인트는 `src/index.js`이며,
여기서 다음 API들을 export 합니다.

- `BaseComponent`
- `getStateComponent`
- `connectDB`
- `createHashRouter`

---

## 2. npm에 배포해서 CDN으로 쓰기 (권장)

`package.json`은 이미 npm 배포와 CDN 사용을 고려해 설정되어 있습니다.

- `"private": false`
- `"main": "dist/lite-react.umd.cjs"`
- `"module": "dist/lite-react.es.js"`
- `"exports"` 에 ESM/CJS 설정
- `"files": ["dist"]`

### 2-1. 패키지 이름/버전 확인

`lite_react/package.json`에서 이름과 버전을 원하는 값으로 바꿉니다.
예시:

```jsonc
{
  "name": "lite_react",
  "version": "0.1.0"
}
```

### 2-2. npm publish

```bash
cd lite_react
npm login          # 처음 한 번만
npm publish
```

성공하면 jsDelivr, unpkg 같은 npm 기반 CDN에서 자동으로 제공됩니다.

---

## 3. CDN에서 사용하기

아래 예시에서는 패키지 이름을 `lite_react`, 버전을 `0.1.0`이라고 가정합니다.

### 3-1. ESM (jsDelivr 예시)

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <title>lite_react CDN ESM 예제</title>
  </head>
  <body>
    <my-counter></my-counter>

    <script type="module">
      import {
        BaseComponent,
        createHashRouter,
      } from "https://cdn.jsdelivr.net/npm/lite_react@0.1.0/dist/lite-react.es.js";

      class MyCounter extends BaseComponent {
        setup({ useState }) {
          useState("count", 0);
        }

        bindEvents({ getCount, setCount }) {
          this.onIncrement = () => setCount(getCount() + 1);
        }
      }

      customElements.define("my-counter", MyCounter);
    </script>
  </body>
  </html>
```

### 3-2. UMD + 전역 변수 (LiteReact)

Vite 라이브러리 설정에서 `name: "LiteReact"`로 지정되어 있으므로,
UMD 번들을 불러오면 전역 객체 `LiteReact`를 사용할 수 있습니다.

```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <title>lite_react CDN UMD 예제</title>
  </head>
  <body>
    <my-counter></my-counter>

    <script src="https://cdn.jsdelivr.net/npm/lite_react@0.1.0/dist/lite-react.umd.js"></script>
    <script>
      const { BaseComponent, createHashRouter } = LiteReact;

      class MyCounter extends BaseComponent {
        setup({ useState }) {
          useState("count", 0);
        }

        bindEvents({ getCount, setCount }) {
          this.onIncrement = () => setCount(getCount() + 1);
        }
      }

      customElements.define("my-counter", MyCounter);
    </script>
  </body>
  </html>
```

---

## 4. npm 없이 직접 CDN/스토리지에 올리기

npm을 쓰지 않고도, 빌드된 결과물을 직접 원하는 CDN/스토리지에 업로드해서 사용할 수 있습니다.

1. 먼저 빌드:

   ```bash
   cd lite_react
   npm run build
   ```

2. 생성된 파일 업로드:

   - `dist/lite-react.es.js`
   - `dist/lite-react.umd.js`

3. 업로드 후 제공되는 URL을 HTML에서 그대로 사용:

   ```html
   <script type="module">
     import { BaseComponent } from "https://example-cdn.com/lite-react.es.js";
   </script>
   ```

혹은:

```html
<script src="https://example-cdn.com/lite-react.umd.js"></script>
<script>
  const { BaseComponent } = LiteReact;
</script>
```

---

## 5. 공개 API 정리

`lite_react/src/index.js`에서 노출하는 기본 API는 다음과 같습니다.

```js
export { BaseComponent, getStateComponent, connectDB } from "./core/core.js";
export { createHashRouter } from "./core/router.js";
```

- `BaseComponent`: 상태 관리와 템플릿 로딩을 담당하는 기본 컴포넌트
- `getStateComponent(idOrRoot)`: 등록된 컴포넌트 레코드를 조회
- `connectDB(root, targetId)`: 다른 컴포넌트의 상태 저장소에 현재 루트를 연결
- `createHashRouter(options)`: `#/path` 기반의 간단한 해시 라우터 생성

이 네 가지를 기준으로, CDN 환경에서도 충분히 앱을 구성할 수 있습니다.

# LiteState

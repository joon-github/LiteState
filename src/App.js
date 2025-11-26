import { BaseComponent } from "./core/core.js";
import { createHashRouter } from "./core/router.js";
import "./components/Count.js";

class AppComponent extends BaseComponent.withModule(import.meta.url) {
  static templateUrl = new URL("./App.html", import.meta.url);
  static styleUrl = new URL("./App.css", import.meta.url);

  setup({ useState }) {
    useState("route", "/");
    useState("routeStack", ["/"]);
    this.routes = ["/", "/about", "/play", "/play/count"];
  }

  initRouter() {
    if (this.router) return;

    this.router = createHashRouter({
      root: this,
      routes: this.routes,
      containerSelector: "[data-router-container]",
      onChange: ({ route, stack }) => {
        this.setRoute(route);
        this.setRouteStack(stack);
      },
    });

    const { route, stack } = this.router.start();
    this.setRoute(route);
    this.setRouteStack(stack);
  }

  bindEvents() {
    this.initRouter();

    this.onNavigate = (event) => {
      event.preventDefault();
      const path = event.currentTarget.dataset.path || "/";
      this.router.navigate(path);
    };
  }

  disconnectedCallback() {
    if (this.router) {
      this.router.dispose();
    }
  }
}

customElements.define("app-component", AppComponent);

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

    this.onDecrement = () => {
      setCount(getCount() - 1);
    };

    this.onClear = () => {
      setCount(0);
    };

    this.onAddUser = () => {
      setUsers(() => ({
        type: "add",
        item: { id: getUsers().length + 1, name: "joon", age: 32 },
      }));
    };

    this.onRemoveUser = () => {
      setUsers(() => ({
        type: "remove",
        condition: (data) => {
          return data.id > 10;
        },
      }));
    };

    this.onUpdateUser = () => {
      setUsers(() => ({
        type: "update",
        condition: (data) => {
          return data.id > 10;
        },
        patch: (data) => {
          return {
            ...data,
            age: Math.floor(Math.random() * 100),
            email: "User@example.com",
          };
        },
      }));
    };

    this.onReverse = () => {
      const newUsers = getUsers().reverse();
      setUsers(newUsers);
    };

    this.onSetStatus = () => {
      switch (getStatus()) {
        case true:
          setStatus(false);
          break;
        case false:
          setStatus("Pending");
          break;
        case "Pending":
          setStatus("Error");
          break;
        case "Error":
          setStatus(true);
          break;
        default:
          setStatus(true);
          break;
      }
    };

    this.onMoveToHome = () => {
      window.location.hash = "/";
    };
  }
}

customElements.define("count-component", CountComponent);

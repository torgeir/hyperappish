# hyperappish
A minimal, hyperapp-like, wired action, state handling thingy that works with plain react components

## Example application

```js
import { mount } from "hyperappish";
import React from "react";
import ReactDOM from "react-dom";
import Rx from "rxjs/Rx";

const state = {
  incrementer: {
    incrementing: false,
    n: 0
  },
  selection: {
    user: null
  },
  users: {
    list: []
  }
};

const ops = {
  incrementer: {
    start: state => ({ ...state, incrementing: true }),
    increment: state => ({ ...state, n: state.n + 1 }),
    stop: state => ({ ...state, incrementing: false })
  },
  selection: {
    select: user => ({ user }),
    remove: () => ({ user: null })
  },
  users: {
    list: state =>
      fetch("https://jsonplaceholder.typicode.com/users")
        .then(res => res.json())
        .then(users => users.map(({ id, name }) => ({ id, name })))
        .then(list => ({ ...state, list }))
  }
};

const { run, actions } = mount(state, ops);

const SelectedUser = ({ user }) => (
  <div>
    <h2>Selected user</h2>
    <span>
      {user.name} <button onClick={() => actions.selection.remove()}>x</button>
    </span>
  </div>
);

const User = ({ user, onClick = v => v }) => (
  <span onClick={onClick} style={{ cursor: "pointer" }}>
    {user.name} ({user.id})
  </span>
);

const Users = ({ list }) => {
  if (!list.length) {
    actions.users.list();
    return <span>Loading..</span>;
  }

  return (
    <div>
      <h2>Users</h2>
      {list.map(user => (
        <div key={user.id}>
          <User user={user} onClick={() => actions.selection.select(user)} />
        </div>
      ))}
    </div>
  );
};

const Incrementer = ({ n }) => (
  <div>
    <h2>Incrementer</h2>
    Incrementing: {n}
    <button onClick={() => actions.incrementer.start()}>start</button>
    <button onClick={() => actions.incrementer.stop()}>stop</button>
  </div>
);

const App = ({ selection, users, counter, incrementer }) => (
  <div>
    {selection.user && <SelectedUser user={selection.user} />}
    <Users {...users} />
    <Incrementer {...incrementer} />
  </div>
);

const middlewares = {
  promise: (action, next) =>
    typeof action.result.then == "function"
      ? action.result.then(result => next({ ...action, result }))
      : next(action),

  observable: (...epics) => {
    const action$ = new Rx.Subject();
    epics.map(epic => epic(action$).subscribe(v => v));
    return (action, next) => {
      const result = next(action);
      action$.next(action);
      return result;
    };
  },

  logActions: (action, next) => (console.log("action", action), next(action)),

  logState: (action, next) => (next(action), _ => console.log("state", state))
};

const incrementer = action$ =>
  action$
    .filter(action => action.type == "incrementer.start")
    .switchMap(() =>
      Rx.Observable.interval(100).takeUntil(
        action$.filter(action => action.type == "incrementer.stop")
      )
    )
    .map(() => actions.incrementer.increment());

const el = document.querySelector(".app");
run(state => ReactDOM.render(<App {...state} />, el), [
  middlewares.promise,
  middlewares.observable(incrementer),
  middlewares.logActions,
  middlewares.logState
]);
```

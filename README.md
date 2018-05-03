# hyperappish

<a href="https://badge.fury.io/js/hyperappish"><img src="https://badge.fury.io/js/hyperappish.svg" alt="npm version" height="18"></a>

A minimal, zero dependency (!), hyperapp-like, wired-action-state-handling-thingy that works with plain react components.

```js
npm install hyperappish
```

## How does it work?

Create a state tree and a corresponding operations that modify each part of it. 

```js
const state = {
  counter: {
    n: 42
  }
};

const ops = {
  counter: {
    increment: state => ({ n: state.n + 1 })
  }
};
```

Actions are automatically bound to the part of the state that matches the key under which they are defined in the operations object (much [like in hyperapp](https://github.com/hyperapp/hyperapp)).

E.g. the `increment` action will get passed the `counter` part of the state, as it resides under the `counter` key of the `ops` object.

Call `mount` with the state and operations to connect them.

```js
import { mount } from "hyperappish";
const { run, actions } = mount(state, ops);
```

Call `run` with a function to render your application. This function is passed the `state` every time it is changed. 

```js
import React from "react";
import { render } from "react-dom";

const el = document.querySelector(".app");
run(state => render(<button onClick={ () => actions.counter.increment() }>{state.counter}++</button>, el));
```

This renders a button with the value `42++` that when clicked will increment its value, over and over, ad infinitum.

## Promises, observables and middleware

This larger, contrieved example shows how to

- **Compose promises in actions**
- **Return state directly from actions, even from promises**
- **Express advanced async flows declaratively with e.g. observables from rxjs**
- **Use middlewares to extend the default behavior, e.g. for logging actions or state after each change**

```js
import { mount } from "hyperappish";
import React from "react";
import ReactDOM from "react-dom";
import Rx from "rxjs/Rx";

const wait = s => new Promise(resolve => setTimeout(resolve, s * 1000));

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
      wait(2)
        .then(_ => fetch("https://jsonplaceholder.typicode.com/users"))
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

[Play with a similar example in codesandbox!](https://x3jvx127jq.codesandbox.io/)

## Middlewares

```js
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
```

## Contributions?

Most welcome! Hit me up with a PR or an issue.

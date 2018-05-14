const { mount } = require("./index");

const nthTime = (n, fn) => {
  let i = 1;
  return (...args) => i++ == n && fn(...args);
};

const after = (fn, done) => (...args) => (fn(...args), done());

test("connects state and actions", done => {
  const state = {
    counter: 41
  };
  const ops = {
    counter: {
      inc: counter => counter + 1
    }
  };

  const { run, actions } = mount(state, ops);
  run(after(({ counter }) => expect(counter).toBe(42), done));

  actions.counter.inc();
});

test("actions receive scoped state as param", done => {
  const state = {
    counter: 41
  };
  const ops = {
    counter: {
      inc: (n, counter) => counter + n
    }
  };

  const { run, actions } = mount(state, ops);
  run(after(({ counter }) => expect(counter).toBe(42), done));

  actions.counter.inc(1);
});

test("actions receive connected actions as last param", done => {
  const state = {
    counter: 41
  };
  const ops = {
    counter: {
      inc: (n, counter, actions) => {
        setTimeout(() => actions.done());
        return counter + n;
      }
    },
    done: s => {
      expect(s.counter).toBe(42);
      done();
      return s;
    }
  };

  const { run, actions } = mount(state, ops);
  run(s => s);

  actions.counter.inc(1);
});

test("setState resets state, e.g. for time travel debugging", done => {
  const state = { counter: 0 };
  const { run, setState } = mount(state, {});

  run(after(({ counter }) => expect(counter).toBe(42), done));

  setState({ counter: 42 });
});

test("getState expose state for use outside of render", () => {
  const state = { counter: 42 };

  const { getState } = mount(state, {});

  expect(getState()).toEqual({ counter: 42 });
});

test("middleware tracks action invocation", done => {
  let i = 0;
  const ops = { doit: _ => _ };
  const { run, actions, middleware } = mount({}, ops);

  run(after(_ => expect(i).toBe(1), done), [(_, __) => i++]);

  actions.doit();
});

test("middleware can change action semantics", done => {
  const state = { counter: 1 };
  const ops = {
    counter: {
      inc: (n, state) =>
        new Promise(resolve => setTimeout(() => resolve(state + n)))
    }
  };
  const { run, actions, middleware } = mount(state, ops);

  run(nthTime(2, after(({ counter }) => expect(counter).toBe(42), done)), [
    middleware.callAction,
    (action, next) => action.result.then(result => next({ ...action, result }))
  ]);

  actions.counter.inc(41);
});

test("actions replace their scoped state in its entirety", done => {
  const state = {
    iAmRemoved: true,
    items: [1, 2]
  };
  const ops = {
    addItem: (item, s) => ({
      items: [...s.items, item]
    })
  };

  const { run, actions } = mount(state, ops);

  let i = 0;
  run(
    after(
      s => expect(s).toEqual({ items: expect.arrayContaining([1, 2, 3]) }),
      done
    )
  );

  actions.addItem(3);
});

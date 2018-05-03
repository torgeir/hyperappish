const identity = v => v;
const doto = (o, fn) => (fn(o), o);
const getIn = (obj, [k, ...ks]) =>
  ks.length === 0 ? obj[k] : getIn(obj[k], ks);
const setIn = (obj, [k, ...ks], val) =>
  ks.length === 0 ? (obj[k] = val) && val : setIn(obj[k], ks, val);
const middleware = ([fn, next, ...fns]) => action =>
  fn(action, next ? middleware([next, ...fns]) : identity);

export const mount = function(state, ops) {
  const wrappedState = { state };

  let render, middlewares;

  const renderAfter = fn => (...args) =>
    doto(fn(...args), _ =>
      setTimeout(
        _ => typeof render === "function" && render(wrappedState.state),
        0
      )
    );

  const proxy = (o, path) =>
    new Proxy(
      getIn(o, path), // makes { ...state } work
      {
        get: (_, name) => getIn(o, path.concat(name)),
        set: renderAfter((_, name, value) => setIn(o, path.concat(name), value))
      }
    );

  const createDispatchWithState = function(fn, field, state, path) {
    return function(...args) {
      const result = fn(...args, proxy({ ...state }, path), actions);
      const handlers = middleware(
        middlewares.concat(
          renderAfter(action => setIn(state, path, action.result))
        )
      );
      const type = path
        .slice(1)
        .concat(field)
        .join(".");
      handlers({ type, result });
    };
  };

  const patch = (ops, state, path) =>
    Object.keys(ops).reduce(
      (acc, field) =>
        doto(
          acc,
          acc =>
            (acc[field] =
              typeof ops[field] == "function"
                ? createDispatchWithState(ops[field], field, state, path)
                : patch(ops[field], state, path.concat(field)))
        ),
      {}
    );

  const actions = patch(ops, wrappedState, ["state"]);

  return {
    actions,
    run: renderAfter((_render, _middlewares = []) => {
      render = _render;
      middlewares = _middlewares;
    })
  };
};

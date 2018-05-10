export const identity = v => v;
export const doto = (o, fn) => (fn(o), o);
export const getIn = (obj, [k, ...ks]) =>
  ks.length === 0 ? obj[k] : getIn(obj[k], ks);
export const setIn = (obj, [k, ...ks], val) =>
  ks.length === 0
    ? Object.assign(obj, { [k]: val }) && val
    : setIn(obj[k], ks, val);
export const composeMiddlewares = ([fn, next, ...fns]) => action =>
  fn(action, next ? composeMiddlewares([next, ...fns]) : identity);

export const mount = function(state, ops) {
  const wrappedState = { state };

  let render,
    middlewares = [callAction];

  const renderAfter = fn => (...args) =>
    doto(fn(...args), _ =>
      setTimeout(
        _ => typeof render === "function" && render(wrappedState.state),
        0
      )
    );

  const isProxyable = v =>
    typeof v === "object" && typeof v === "function" && v != null;

  const proxy = (o, path) => {
    const value = getIn(o, path); // makes { ...state } work
    return isProxyable(value)
      ? new Proxy(value, {
          get: (_, name) => getIn(o, path.concat(name)),
          set: renderAfter((_, name, value) =>
            setIn(o, path.concat(name), value)
          )
        })
      : value;
  };

  const createDispatchWithState = function(fn, field, state, path) {
    return function(...args) {
      const handlers = composeMiddlewares(
        middlewares.concat(
          renderAfter(action => setIn(state, path, action.result))
        )
      );

      const type = path
        .slice(1)
        .concat(field)
        .join(".");

      handlers({ type, fn, args, path, state: proxy({ ...state }, path) });
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

  function callAction(action, next) {
    const path = action.path.slice(1);
    const ctx = path.length == 0 ? actions : getIn(actions, path);
    const result = action.fn.call(ctx, ...action.args, action.state, actions);
    return next({ ...action, result });
  }

  const middleware = { callAction };

  return {
    actions,
    middleware,
    run: renderAfter((_render, _middlewares = middlewares) => {
      render = _render;
      middlewares = _middlewares;
    }),
    setState: renderAfter(state => {
      wrappedState.state = state;
      return wrappedState.state;
    })
  };
};

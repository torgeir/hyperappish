const identity = v => v;
const doto = (o, fn) => (fn(o), o);
const getIn = (obj, [k, ...ks]) =>
  ks.length === 0 ? obj[k] : getIn(obj[k], ks);
const setIn = (obj, [k, ...ks], val) =>
  ks.length === 0 ? (obj[k] = val) && val : setIn(obj[k], ks, val);
const composeMiddlewares = ([fn, next, ...fns]) => action =>
  fn(action, next ? composeMiddlewares([next, ...fns]) : identity);

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
      const handlers = composeMiddlewares(
        middlewares.concat(
          renderAfter(action => setIn(state, path, action.result))
        )
      );

      const type = path
        .slice(1)
        .concat(field)
        .join(".");

      handlers({ type, fn, args, state: proxy(Object.assign({}, state), path) });
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

  const middleware = {
    callAction: (action, next) => {
      const result = action.fn(...action.args, action.state, actions);
      return next({ ...action, result });
    }
  };

  return {
    actions,
    middleware,
    run: renderAfter((_render, _middlewares = [middleware.callAction]) => {
      render = _render;
      middlewares = _middlewares;
    })
  };
};

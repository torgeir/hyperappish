export const identity = v => v;
export const doto = (o, fn) => (fn(o), o);
export const getIn = (obj, [k, ...ks]) =>
  ks.length === 0 ? obj[k] : getIn(obj[k], ks);
export const setIn = (obj, [k, ...ks], val) =>
  ks.length === 0 ? ((obj[k] = val), val) : setIn(obj[k], ks, val);
export const composeMiddlewares = ([fn, next, ...fns]) => action =>
  fn(action, next ? composeMiddlewares([next, ...fns]) : identity);

const is = t => v => typeof v === t,
  isObject = is("object"),
  isFunction = is("function"),
  isProxyable = v => isObject(v) && isFunction(v) && v != null;

export const mount = function(state, ops) {
  const wrappedState = { state };

  let renderer,
    middlewares = [callAction];

  const render = _ =>
    isFunction(renderer) && setTimeout(() => renderer(wrappedState.state));

  const renderAfter = fn => (...args) => doto(fn(...args), render);

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

  const createDispatchWithState = (fn, field, state, path) => (...args) =>
    composeMiddlewares([
      ...middlewares,
      renderAfter(action => setIn(wrappedState, path, action.result))
    ])({
      fn,
      args,
      path,
      state: proxy({ ...state }, path),
      type: path
        .slice(1)
        .concat(field)
        .join(".")
    });

  const patch = (ops, state, path) =>
    Object.keys(ops).reduce(
      (acc, field) =>
        doto(
          acc,
          acc =>
            (acc[field] = isFunction(ops[field])
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
    if (result === undefined) {
      console.warn(
        `Action ${action.type}(${
          action.args.length > 0 ? action.args.map(JSON.stringify) : ""
        }) failed to produce a result, did you forget to provide a return value?`
      );
    }
    return next({ ...action, result });
  }

  return {
    actions,
    middleware: { callAction },
    run: renderAfter((_renderer, _middlewares = middlewares) => {
      renderer = _renderer;
      middlewares = _middlewares;
    }),
    getState: () => wrappedState.state,
    setState: renderAfter(state => {
      wrappedState.state = state;
      return wrappedState.state;
    })
  };
};

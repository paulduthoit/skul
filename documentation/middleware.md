# Middleware

### `Model.setMiddleware(name, middleware)`

Set a middleware that will be called in the relationship retrieve process.

The `name` argument can be `'beforeSelect'` or `'afterSelect'` and is called before or after the select method.
The `middleware` argument is the middleware function. When it called, the `context` argument is passed to the function and it must return a `Promise` object.

The `context` object has `filter`, `fields` and `params` keys.

--------

### `Model.getMiddleware(name)`

Get a defined middleware.

The `name` argument can be `'beforeSelect'` or `'afterSelect'`.

--------

### `Model.getMiddlewares()`

Get all defined middlewares.

--------

### `Model.runBeforeSelectMiddleware()`

Run the defined `beforeSelect` middleware. If the `beforeSelect` middleware was not defined, it return a `Promise.resolve` object.

--------

### `Model.runAfterSelectMiddleware()`

Run the defined `afterSelect` middleware. If the `afterSelect` middleware was not defined, it return a `Promise.resolve` object.
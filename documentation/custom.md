# Custom

### `Model.addCustom(key, custom, options)`

Add a custom entry for the select building.

The `key` argument must be a `string` and represent the field to call to reach the custom entry.
The `custom` argument must be an `object`.

The `custom` object has `$field`, `$join` and `$groupby` keys, here an exemple :

```js
{
    '$field': [
        'COUNT(', { '$alias': 't1', '$key': 'id' }, ')'
    ],
    '$join': [ { '$type': 'left', '$model': TripModel, '$alias': 't1', '$key': 'id_vehicle', '$on': 'id' } ],
    '$groupby': [ { '$key': 'id' } ]
}
```

--------

### `Model.getCustom(key)`

Get a defined custom entry.

The `key` must be a `string` and is the field supplied in the `addCustom` method.

--------

### `Model.getCustoms()`

Get all defined custom entries.

--------

### `Model.removeCustom(key)`

Remove a defined custom entry.

The `key` must be a `string` and is the field supplied in the `addCustom` method.

--------

### `Model.getCustomKeys()`

Get keys of all defined custom entries.
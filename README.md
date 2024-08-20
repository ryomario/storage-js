<center>
<h1>StorageJS</h1>
</center>

Client based storage, using `indexedDB`API.
Simplified for easier use.

> Read more about `indexedDB`, https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API

## Simple Usage

```javascript
// init
const storageJS = new StorageJS('test_db');
// add / update data
storageJS.table('preferences').setData('test_data','data testing 1');
// get data
const data = await storageJS.table('preferences').getData('test_data');
```
> Note : Don't forget that method `setData` and `getData` will return `Promise` Object
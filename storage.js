(function(){
    function copyObject(obj) {
        if(typeof obj !== 'object')return obj;
        const copied = Array.isArray(obj)?[]:{};

        for (const key in obj) {
            let copiedValue = obj[key];
            if (typeof copiedValue === 'object') {
                copiedValue = copyObject(copiedValue);
            }
            copied[key] = copiedValue;
        }
        return copied;
    }
    function createObject(data) {
        if(typeof data === 'undefined' || data == null)return null;
        if(typeof data === 'object')return copyObject(data);

        return {
            id: data,
            value: data,
        }
    }
    function getObjectValue(data) {
        if(typeof data !== 'object')return data;
        if('id' in data && 'value' in data)return data.value;
        return copyObject(data);
    }
    class Transaction {
        /**
         * 
         * @param {IDBDatabase} db 
         */
        constructor(db, tablename,type) {
            this.db = db;
            this.tablename = tablename;
            this.type = type;

            this._t = this.db.transaction(this.tablename,this.type);
        }
        get(id) {
            return new Promise((resolve, reject) => {
                const objectStore = this._t.objectStore(this.tablename);
                const request = objectStore.get(id);
                request.onerror = function(ev) {
                    reject(request.error);
                }
                request.onsuccess = function(ev) {
                    resolve(getObjectValue(request.result));
                }
            });
        }
        set(id,data) {
            data = createObject(data);
            data.id = id;
            return new Promise((resolve, reject) => {
                const objectStore = this._t.objectStore(this.tablename);
                const request = objectStore.get(id);
                request.onerror = function(ev) {
                    reject(request.error);
                }
                request.onsuccess = function(ev) {
                    const dataExist = request.result;
                    let setRequest;
                    if(!dataExist){
                        setRequest = objectStore.add(data);
                    } else {
                        setRequest = objectStore.put(data);
                    }
                    setRequest.onerror = function(ev2) {
                        reject(setRequest.error);
                    }
                    setRequest.onsuccess = function(ev2) {
                        resolve(setRequest.result);
                    }
                }
            });
        }
        async getAllInTurn(onsuccess=null,onerror=null) {
            try {
                const objectStore = this._t.objectStore(this.tablename);
                const request = objectStore.openCursor();
                request.onerror = function(ev) {
                    throw request.error;
                }
                request.onsuccess = function(ev) {
                    const cursor = request.result;
                    if(cursor){
                        if(typeof onsuccess === 'function')onsuccess(getObjectValue(cursor.value));
                        cursor.continue();
                    }
                }
                return [];
            } catch (error) {
                if(typeof onerror === 'function')onerror(request.error);
                else throw error;
            }
        }
    
        static create(db, tablename, type) {
            return new Promise((resolve, reject) => {
                const transaction = new Transaction(db, tablename, type);

                transaction._t.onerror = function(ev) {
                    reject(transaction._t.error);
                }
                resolve(transaction);
            });
        }
        static RO({db, tablename}) {
            return Transaction.create(db, tablename, 'readonly');
        }
        static RW({db, tablename}) {
            return Transaction.create(db, tablename, 'readwrite');
        }
    }

    class StorageJS {
        dbname;
        dbversion;
        constructor(dbname) {
            StorageJS.checkSupport();

            if(!dbname)dbname = this.constructor.name + '_db';
            this.dbname = dbname;
            this.dbversion = 1;
        }
        /**
         * Open DB then 
         * @param {string} tablename 
         * @returns 
         */
        async open(tablename,forceUpgrade=false) {
            // find existing db version
            const dbs = await indexedDB.databases();
            const foundId = dbs.findIndex(db => db.name == this.dbname);
            if(foundId != -1){
                this.dbversion = dbs[foundId].version;
            }

            if(forceUpgrade)this.dbversion += 1;
            
            return new Promise((resolve, reject) => {
                const request = indexedDB.open(this.dbname,this.dbversion);

                request.onupgradeneeded = (event) => {
                    const db = request.result;
                    if(!db.objectStoreNames.contains(tablename)){
                        db.createObjectStore(tablename,{keyPath: 'id'});
                    }
                }
                request.onerror = () => {
                    reject(request.error);
                }
                request.onsuccess = (event) => {
                    const db = request.result;
                    if(!db.objectStoreNames.contains(tablename)){
                        db.close();
                        this.open(tablename,true).then(resolve).catch(reject);
                        return;
                    }
                    resolve({db, tablename});
                }
            });
        }
        async openTransaction(tablename) {
            return await this.open(tablename).then(Transaction.RW);
        }
        table(tablename) {
            const $this = this;
            async function getData(id,onsuccess=null,onerror=null) {
                try {
                    const transaction = await $this.openTransaction(tablename);
                    const data = await transaction.get(id);
                    if(typeof onsuccess === 'function')onsuccess(data);
                    return data;
                } catch (error) {
                    if(typeof onerror === 'function')onerror(error);
                    else console.error(error);
                }
            }
            async function setData(id, data,onsuccess=null,onerror=null) {
                try {
                    const transaction = await $this.openTransaction(tablename);
                    const result = await transaction.set(id,data);
                    if(typeof onsuccess === 'function')onsuccess(result);
                    return result;
                } catch (error) {
                    if(typeof onerror === 'function')onerror(error);
                    else console.error(error);
                }
            }
            async function getAllInTurn(onsuccess=null,onerror=null) {
                try {
                    const transaction = await $this.openTransaction(tablename);
                    const allData = [];
                    transaction.getAllInTurn(d => {
                        if(typeof onsuccess === 'function')onsuccess(d);
                    });
                    return allData;
                } catch (error) {
                    if(typeof onerror === 'function')onerror(error);
                    else console.error(error);
                }
            }

            return {
                getAllInTurn,
                getData,
                setData,
            }
        }

        static checkSupport() {
            if(!indexedDB){
                throw new Error('indexedDB not supported!');
            }

            return true;
        }
    }
    StorageJS.Transaction = Transaction;

    window.StorageJS = StorageJS;
})();
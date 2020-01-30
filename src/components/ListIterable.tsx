import ListIterator from "./ListIterator";


export default class ListIterable<T> implements Iterable<T>{

    public list:Array<T> = new Array<T>();
    public supplier:IterableIterator<T>;

    [Symbol.iterator](): Iterator<T> {
        return new ListIterator<T>({
            supplier:this.supplier,
            list:this.list,
        });
    }
    
    constructor(supplier:IterableIterator<T>){
        this.supplier=supplier;
    }
    
    static from<TData>(supplier:IterableIterator<TData>) {
        return new ListIterable<TData>(supplier);
    }

    isEmpty(){
        if(this.list.length === 0){ 
            // current moization list is empty
            // => check for the supplier if the list has not been parsed
            let temp =  new ListIterator<T>({
                supplier:this.supplier,
                list:this.list,
            });
            // memoize iterator for future use
            let _isEmpty = true;
            for(let e of temp){
                _isEmpty = false;
            }
            return _isEmpty;
        } else return false;
    }

}


interface ListIteratorInterface<T>{
    supplier: ListIterator<T> | IterableIterator<T>,
    list?:Array<T>,
    index?:number,
    done?:boolean
}

export default class ListIterator<T> implements IterableIterator<T>{
    [Symbol.iterator](): IterableIterator<T> {
        return this;
    }
    
    public supplier: ListIterator<T> | IterableIterator<T>; // IterableIterator is implemented by Arrays
    public list:Array<T>;
    public index:number;
    public done:boolean;

    constructor(from:ListIterator<T>|ListIteratorInterface<T>) {
        this.supplier = from.supplier;
        this.list = from.list || [];
        this.index = from.index || 0;
        this.done = from.done || false;
    }

    /**
     * check if the iterator has a next object
     * (Also store the nextValue in a memoizing list)
     */
    hasNext(): boolean {
        if (this.index < this.list.length){ 
            return true;
        } else if (this.done === true) {
            return false;
        } else { // Check the suplier
            var next = this.supplier.next();
            if (next.done) { // No more data in the supplier
                this.done = true;
                return false;
            } else if(next.value){ // data found in the supplier, push it in the memoization list
                this.list.push(next.value);
                return true;
            } else return false; // 
        }
    }

    /**
     * Return the next object available in the supplier
     * @see IterableIterator<T> : 
     * The returned object must conform to the IteratorResult interface. If a previous call to the next method of an Iterator has returned an IteratorResult object whose done property is true, then all subsequent calls to the next method of that object should also return an IteratorResult object whose done property is true. However, this requirement is not enforced.
     */
    next() : IteratorResult<T,T|undefined>{
        if (!this.hasNext())
            return {done: true, value:undefined};
        else
            return {done: false, value: this.list[this.index++]};
    }

    hasPrevious(): boolean {
        return this.index > 0; // === previous element were loaded and accessed
    }

    previous() : IteratorResult<T> {
        if (!this.hasPrevious())
            return {done: true, value:undefined};
        else
            return {
                done: false,
                value: this.list[--this.index]};
    }

    clone() {
        // backup index and iterator state
        let temp_index = this.index;
        let temp_done = this.done;
        // memoize the current "supplier" in the list array
        while(this.hasNext()){
            this.next();
        }
        // reset the current iterator state
        this.index = temp_index;
        this.done = temp_done;

        // Create a copy with current state
        return new ListIterator<T>({
                supplier:this.supplier,
                list:this.list.slice(),
                index:this.index,
                done:this.done
            });
    }

    /**
     * Rewind the iterator
     */
    rewind() : number{
        let i = 0;
        while (this.hasPrevious()) {
            this.previous();
            i++;
        }
        this.done = false;
        return i;
    }

    forward(toIndex:number) {
        while (toIndex-- > 0)
            this.next();
    }
    
    
    consume() : Array<T> {
        let array = Array<T>();
        let index_copy = this.index;
        let done_copy = this.done;
        this.index = 0; // reset iterator
        this.done = false;
        for(let _next = this.next(); _next.done; _next = this.next()){
            if(_next.value != null) array.push(_next.value);
        }
        this.index = index_copy;
        this.done = done_copy;
        return array;
    }

    
}

/** IteratorResult Interface Properties
 * Property 	Value 	Requirements
done 	Either true or false. 	This is the result status of an iterator next method call. If the end of the iterator was reached done is true. If the end was not reached done is false and a value is available. If a done property (either own or inherited) does not exist, it is consider to have the value false.
value 	Any ECMAScript language value. 	If done is false, this is the current iteration element value. If done is true, this is the return value of the iterator, if it supplied one. If the iterator does not have a return value, value is undefined. In that case, the value property may be absent from the conforming object if it does not inherit an explicit value property.
 */
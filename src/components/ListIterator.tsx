

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
    
    public supplier: ListIterator<T> | IterableIterator<T>;
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
     * Check if
     */
    hasNext(): boolean {
        if (this.index < this.list.length) return true;
        else if (this.done) return false;
        else { // Check the suplier
            var next = this.supplier.next();
            if (next.done) { // No more data
                this.done = true;
                return false;
            } else if(next.value){ // new data
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
    next() : IteratorResult<T>{
        if (!this.hasNext())
            return {done: true, value:undefined};
        else
            return {done: false, value: this.list[this.index++]}; // Note : index is 0 when the list is empty
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
        return new ListIterator<T>(this);
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
        return i;
    }

    forward(toIndex:number) {
        while (toIndex-- > 0)
            this.next();
    }
    
    
    consume() : Array<T> {
        let array = Array<T>();
        for(let _next = this.next(); _next.done; _next = this.next()){
            array.push(_next.value);
        }
        return array;
    }

    
}

/** IteratorResult Interface Properties
 * Property 	Value 	Requirements
done 	Either true or false. 	This is the result status of an iterator next method call. If the end of the iterator was reached done is true. If the end was not reached done is false and a value is available. If a done property (either own or inherited) does not exist, it is consider to have the value false.
value 	Any ECMAScript language value. 	If done is false, this is the current iteration element value. If done is true, this is the return value of the iterator, if it supplied one. If the iterator does not have a return value, value is undefined. In that case, the value property may be absent from the conforming object if it does not inherit an explicit value property.
 */
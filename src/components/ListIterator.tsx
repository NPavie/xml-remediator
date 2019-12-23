
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

    hasNext(): boolean {
        if (this.index < this.list.length) return true;
        else if (this.done) return false;

        var next = this.supplier.next();
        if (next.done) { 
            this.done = true;
            return false;
        } else if(next.value){
            this.list.push(next.value);
            return true;
        } else return false;
    }

    next() : IteratorResult<T, any>{
        if (!this.hasNext())
            return {done: true, value:undefined};
        else
            return {done: false, value: this.list[this.index++]};
    }

    hasPrevious(): boolean {
        return this.index > 0;
    }

    previous() {
        if (!this.hasPrevious())
            return {done: true};
        else
            return {
                done: false,
                value: this.list[--this.index]};
    }

    clone() {
        return new ListIterator<T>(this);
    }

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
        let next;
        while (!(next = this.next()).done) array.push(next.value);
        return array;
    }

    // implement push, pop, get ?
    

}
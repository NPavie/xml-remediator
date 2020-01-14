import NoSuchElementException from "./exceptions/NoSuchElementException";


export default class Optional<T>{
    public done:boolean;
    public value?:T;
    constructor(done:boolean, value?:T){
        this.done = done;
        this.value = value;
    }
    public static of<T>(value:undefined | T){
        return new Optional<T>(value == null ? false : true, value);
    }
    
    public static empty<T>(){
        return new Optional<T>(true);
    }
    
    /**
     * 
     */
	public isPresent(){
		return (this.value ? this.value !== null : false);
    }
    
    /**
     * 
     * @param other 
     */
    public orElse(other:T|undefined){
        if(this.value != null) return this.value;
        else return other;
    }
    
    public get():T{
        if(this.value != null) return this.value;
        else throw new NoSuchElementException("No value present");
    }
}
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
	
	public isPresent(){
		return !(this.value == null);
    }
    
    public orElse(other:T|undefined){
        if(this.value != null) return this.value;
        else return other;
    }
        
}